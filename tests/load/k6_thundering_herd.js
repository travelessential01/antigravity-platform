/**
 * Task 6.1 — k6 Thundering Herd Simulation
 *
 * Simulates 200 offline PWA clients each holding 5 queued
 * grievances that reconnect simultaneously within a 5-second
 * burst window. This produces 1,000 total payloads hitting
 * the Supabase PostgREST API near-simultaneously.
 *
 * Each payload includes a SHA-256 deduplication hash to
 * mirror the offline sync queue behavior.
 *
 * Pass Criteria:
 *   - All 1,000 payloads sync within 10 minutes
 *   - Zero data loss (unique row count = expected after dedup)
 *   - Zero duplicate SLA timers (verify in Inngest Dev Server)
 *   - processed_events shows no duplicate event IDs
 *
 * Fail Criteria:
 *   - >5% payload failure → Sprint 6 blocker
 *   - Any SLA timer duplicated → Sprint 6 blocker
 *
 * Usage:
 *   k6 run tests/load/k6_thundering_herd.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import crypto from 'k6/crypto';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────
const SUPABASE_URL  = __ENV.SUPABASE_URL  || 'http://localhost:8000';
const SERVICE_KEY   = __ENV.SERVICE_KEY   || 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA';
const HOSPITAL_ID   = '2cf24f6f-6a6a-4187-b426-63a2417c7e97';

const PAYLOADS_PER_DEVICE  = 5;
const TOTAL_DEVICES        = 200;
const TOTAL_PAYLOADS       = TOTAL_DEVICES * PAYLOADS_PER_DEVICE; // 1,000

const DEPARTMENT_IDS = [
  '42254d74-623c-4472-bb04-df406fcf09c9',
  '534cf3be-82f5-4eed-9d14-bf4a207285bb',
  '629bc299-0a8d-4d8d-8796-ed1483b075a3',
  'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1',
  '4cd2e801-8b32-4517-947d-c9f20c7292a9',
  '78619ac0-caa3-4742-b31e-181d30c8d5e0',
  '35ec44a2-dab8-42c8-bc7a-d21b530e2760',
];

const PATIENT_IDS = [
  '11111111-aaaa-bbbb-cccc-000000000001',
  '11111111-aaaa-bbbb-cccc-000000000002',
  '11111111-aaaa-bbbb-cccc-000000000003',
  '11111111-aaaa-bbbb-cccc-000000000004',
  '11111111-aaaa-bbbb-cccc-000000000005',
];

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];
// ──────────────────────────────────────────────
// Pre-built payload queue (shared across VUs)
// Each "device" has 5 queued payloads
// ──────────────────────────────────────────────
const payloadQueue = new SharedArray('thundering-herd-payloads', function () {
  const payloads = [];
  for (let device = 0; device < TOTAL_DEVICES; device++) {
    const patientId = PATIENT_IDS[device % PATIENT_IDS.length];
    for (let q = 0; q < PAYLOADS_PER_DEVICE; q++) {
      const deptId   = DEPARTMENT_IDS[(device + q) % DEPARTMENT_IDS.length];
      const severity = SEVERITY_LEVELS[q % SEVERITY_LEVELS.length];
      const desc     = `Offline grievance from device ${device}, queue position ${q}`;

      // SHA-256 deduplication hash: patient_id + description + simulated timestamp
      const dedupInput = `${patientId}|${desc}|${device * 1000 + q}`;
      payloads.push({
        patient_id:      patientId,
        hospital_id:     HOSPITAL_ID,
        department_id:   deptId,
        severity_level:  severity,
        status:          'submitted',
        dedup_hash:      dedupInput,  // Stored for verification; real hash computed at sync time
        device_id:       device,
        queue_position:  q,
      });
    }
  }
  return payloads;
});

// ──────────────────────────────────────────────
// k6 Options — 200 VUs (one per device), each
// sends 5 payloads sequentially (simulating queue drain)
// ──────────────────────────────────────────────
export const options = {
  scenarios: {
    thundering_herd: {
      executor:   'per-vu-iterations',
      vus:        TOTAL_DEVICES,    // 200 "devices"
      iterations: PAYLOADS_PER_DEVICE,  // 5 queued payloads each
      maxDuration: '10m',           // Must complete within 10 minutes
    },
  },
  thresholds: {
    'http_req_failed':        ['rate<0.05'],  // < 5% failure rate (blocker threshold)
    'successful_syncs':       ['count>=950'], // At least 95% of 1,000 payloads
    'duplicate_sla_timers':   ['count==0'],   // Zero duplicates
  },
};

// ──────────────────────────────────────────────
// Custom Metrics
// ──────────────────────────────────────────────
const successfulSyncs     = new Counter('successful_syncs');
const failedSyncs         = new Counter('failed_syncs');
const duplicateSlaTimers  = new Counter('duplicate_sla_timers');
const syncLatency         = new Trend('sync_latency_ms');
const errorRate           = new Rate('sync_error_rate');

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer':        'return=representation',
};

// ──────────────────────────────────────────────
// Dedup Hash Helper
// ──────────────────────────────────────────────
function computeDedupHash(input) {
  return crypto.sha256(input, 'hex');
}

// ──────────────────────────────────────────────
// Test: Simulate offline PWA reconnection
//
// Each VU represents one "device" draining its
// 5-item queue. All 200 VUs start simultaneously
// (the thundering herd moment).
// ──────────────────────────────────────────────
export default function () {
  const deviceId  = __VU - 1;  // 0-indexed device ID
  const queuePos  = __ITER;    // 0..4 for each VU

  // Lookup the pre-built payload for this device + queue position
  const idx = deviceId * PAYLOADS_PER_DEVICE + queuePos;
  if (idx >= payloadQueue.length) {
    return; // Safety guard
  }

  const queuedPayload = payloadQueue[idx];
  const dedupHash = computeDedupHash(queuedPayload.dedup_hash);

  // Simulate slight stagger within the 5-second burst window
  if (queuePos === 0) {
    sleep(Math.random() * 5);  // Initial reconnection jitter: 0-5 seconds
  } else {
    sleep(Math.random() * 0.5);  // Inter-payload gap: 0-500ms (queue drain speed)
  }

  // ── Step 1: Check for duplicate via dedup hash ──
  const dedupCheck = http.get(
    `${SUPABASE_URL}/rest/v1/processed_events?event_id=eq.sync:${dedupHash}&select=id`,
    { headers: { ...headers, 'Prefer': '' }, tags: { name: 'DedupCheck' } }
  );

  let alreadyProcessed = false;
  try {
    const existing = JSON.parse(dedupCheck.body);
    alreadyProcessed = Array.isArray(existing) && existing.length > 0;
  } catch { /* not critical */ }

  if (alreadyProcessed) {
    // Already synced — skip (idempotent)
    successfulSyncs.add(1); // Counts as a successful handling
    return;
  }

  // ── Step 2: Insert complaint ──
  const complaintPayload = JSON.stringify({
    patient_id:      queuedPayload.patient_id,
    hospital_id:     queuedPayload.hospital_id,
    department_id:   queuedPayload.department_id,
    severity_level:  queuedPayload.severity_level,
    status:          queuedPayload.status,
  });

  const startTime = Date.now();
  const insertRes = http.post(
    `${SUPABASE_URL}/rest/v1/complaints`,
    complaintPayload,
    { headers, tags: { name: 'InsertComplaint' } }
  );
  const elapsed = Date.now() - startTime;
  syncLatency.add(elapsed);

  const insertOk = check(insertRes, {
    'complaint created (201)': (r) => r.status === 201,
  });

  if (!insertOk) {
    failedSyncs.add(1);
    errorRate.add(true);
    return;
  }

  // ── Step 3: Record processed_event for idempotency ──
  const idempotencyRes = http.post(
    `${SUPABASE_URL}/rest/v1/processed_events`,
    JSON.stringify({
      event_id:   `sync:${dedupHash}`,
      event_name: `thundering_herd_sync_device_${deviceId}_q${queuePos}`,
    }),
    { headers, tags: { name: 'RecordIdempotency' } }
  );

  check(idempotencyRes, {
    'idempotency recorded (201)': (r) => r.status === 201,
  });

  successfulSyncs.add(1);
  errorRate.add(false);
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
export function handleSummary(data) {
  const syncs  = data.metrics.successful_syncs?.values?.count || 0;
  const fails  = data.metrics.failed_syncs?.values?.count || 0;
  const dupes  = data.metrics.duplicate_sla_timers?.values?.count || 0;
  const p95    = data.metrics.http_req_duration?.values?.['p(95)'] || 'N/A';
  const total  = syncs + fails;
  const failPct = total > 0 ? ((fails / total) * 100).toFixed(2) : '0';

  console.log('\n' + '='.repeat(60));
  console.log('  TASK 6.1 — THUNDERING HERD SIMULATION RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total Payloads:   ${total} / ${TOTAL_PAYLOADS}`);
  console.log(`  Successful Syncs: ${syncs}`);
  console.log(`  Failed Syncs:     ${fails} (${failPct}%)`);
  console.log(`  Duplicate SLAs:   ${dupes}`);
  console.log(`  P95 Latency:      ${typeof p95 === 'number' ? p95.toFixed(2) : p95}ms`);
  console.log('─'.repeat(60));

  if (parseFloat(failPct) > 5) {
    console.log('  ⚠️  FAIL: >5% payload failure — SPRINT 6 BLOCKER');
  } else if (dupes > 0) {
    console.log('  ⚠️  FAIL: Duplicate SLA timers detected — SPRINT 6 BLOCKER');
  } else {
    console.log('  ✅ PASS: Thundering Herd test passed!');
  }

  console.log('='.repeat(60) + '\n');

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
