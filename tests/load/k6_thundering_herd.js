import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import crypto from 'k6/crypto';

function requiredEnv(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`Missing required k6 env var: ${name}`);
  }
  return value;
}

function csvEnv(name) {
  return requiredEnv(name).split(',').map((value) => value.trim()).filter(Boolean);
}

const SUPABASE_URL = requiredEnv('SUPABASE_URL');
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const HOSPITAL_ID = requiredEnv('TEST_HOSPITAL_ID');
const DEPARTMENT_IDS = csvEnv('TEST_DEPARTMENT_IDS');
const PATIENT_IDS = csvEnv('TEST_PATIENT_IDS');
const RUN_ID = __ENV.TEST_RUN_ID || `k6-herd-${Date.now()}`;
const PAYLOADS_PER_DEVICE = Number(__ENV.TEST_PAYLOADS_PER_DEVICE || 5);
const TOTAL_DEVICES = Number(__ENV.TEST_TOTAL_DEVICES || 200);
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

const payloadQueue = new SharedArray('thundering-herd-payloads', () => {
  const payloads = [];
  for (let device = 0; device < TOTAL_DEVICES; device++) {
    const patientId = PATIENT_IDS[device % PATIENT_IDS.length];
    for (let position = 0; position < PAYLOADS_PER_DEVICE; position++) {
      payloads.push({
        patient_id: patientId,
        hospital_id: HOSPITAL_ID,
        department_id: DEPARTMENT_IDS[(device + position) % DEPARTMENT_IDS.length],
        severity_level: SEVERITY_LEVELS[position % SEVERITY_LEVELS.length],
        status: 'submitted',
        idempotency_input: `${RUN_ID}|${device}|${position}|${patientId}`,
        device_id: device,
        queue_position: position,
      });
    }
  }
  return payloads;
});

export const options = {
  scenarios: {
    thundering_herd: {
      executor: 'per-vu-iterations',
      vus: TOTAL_DEVICES,
      iterations: PAYLOADS_PER_DEVICE,
      maxDuration: __ENV.K6_MAX_DURATION || '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    successful_syncs: [`count>=${Math.floor(TOTAL_DEVICES * PAYLOADS_PER_DEVICE * 0.95)}`],
    duplicate_idempotency_keys: ['count==0'],
    http_5xx: ['count==0'],
  },
};

const successfulSyncs = new Counter('successful_syncs');
const failedSyncs = new Counter('failed_syncs');
const duplicateIdempotencyKeys = new Counter('duplicate_idempotency_keys');
const http5xx = new Counter('http_5xx');
const syncLatency = new Trend('sync_latency_ms');
const errorRate = new Rate('sync_error_rate');

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: 'return=representation',
  'x-test-run-id': RUN_ID,
};

export default function () {
  const deviceId = __VU - 1;
  const queuePosition = __ITER;
  const queuedPayload = payloadQueue[deviceId * PAYLOADS_PER_DEVICE + queuePosition];

  if (!queuedPayload) {
    return;
  }

  const idempotencyKey = `sync:${crypto.sha256(queuedPayload.idempotency_input, 'hex')}`;

  if (queuePosition === 0) {
    sleep(Math.random() * 5);
  } else {
    sleep(Math.random() * 0.5);
  }

  const dedupCheck = http.get(
    `${SUPABASE_URL}/rest/v1/processed_events?event_id=eq.${encodeURIComponent(idempotencyKey)}&select=id`,
    { headers: { ...headers, Prefer: '' }, tags: { name: 'DedupCheck', run_id: RUN_ID } },
  );

  try {
    const existing = JSON.parse(dedupCheck.body);
    if (Array.isArray(existing) && existing.length > 0) {
      duplicateIdempotencyKeys.add(1);
      successfulSyncs.add(1);
      return;
    }
  } catch {
    // Continue to insert; the failure will be reflected by the next checks.
  }

  const started = Date.now();
  const insertRes = http.post(
    `${SUPABASE_URL}/rest/v1/complaints`,
    JSON.stringify({
      patient_id: queuedPayload.patient_id,
      hospital_id: queuedPayload.hospital_id,
      department_id: queuedPayload.department_id,
      severity_level: queuedPayload.severity_level,
      status: queuedPayload.status,
    }),
    { headers, tags: { name: 'InsertComplaint', run_id: RUN_ID } },
  );
  syncLatency.add(Date.now() - started);

  const inserted = check(insertRes, {
    'complaint created': (r) => r.status === 201,
  });

  if (!inserted) {
    failedSyncs.add(1);
    errorRate.add(true);
    if (insertRes.status >= 500) {
      http5xx.add(1);
    }
    return;
  }

  const idempotencyRes = http.post(
    `${SUPABASE_URL}/rest/v1/processed_events`,
    JSON.stringify({
      event_id: idempotencyKey,
      event_name: `thundering_herd_sync_${RUN_ID}`,
      payload: { runId: RUN_ID, deviceId, queuePosition },
    }),
    { headers, tags: { name: 'RecordIdempotency', run_id: RUN_ID } },
  );

  const idempotencyOk = check(idempotencyRes, {
    'idempotency recorded': (r) => r.status === 201 || r.status === 409,
  });

  if (idempotencyOk) {
    successfulSyncs.add(1);
    errorRate.add(false);
  } else {
    failedSyncs.add(1);
    errorRate.add(true);
    if (idempotencyRes.status >= 500) {
      http5xx.add(1);
    }
  }
}

export function handleSummary(data) {
  const values = data.metrics.http_req_duration?.values || {};
  const summary = {
    runId: RUN_ID,
    p95: values['p(95)'],
    p99: values['p(99)'],
    httpFailureRate: data.metrics.http_req_failed?.values?.rate,
    successfulSyncs: data.metrics.successful_syncs?.values?.count,
    failedSyncs: data.metrics.failed_syncs?.values?.count,
    http5xx: data.metrics.http_5xx?.values?.count,
    duplicateIdempotencyKeys: data.metrics.duplicate_idempotency_keys?.values?.count,
  };

  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`,
    [`tests/load/results/${RUN_ID}.json`]: JSON.stringify({ summary, raw: data }, null, 2),
  };
}
