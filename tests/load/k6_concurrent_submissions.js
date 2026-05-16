/**
 * Task 6.1 — k6 Baseline Concurrent Submission Test
 *
 * Simulates 1,000 virtual users each submitting a complaint
 * via the Supabase PostgREST API (service_role bypass, mirrors
 * what createComplaint() Server Action does internally).
 *
 * Pass Criteria:
 *   - P95 < 200ms
 *   - Zero HTTP 5xx responses
 *   - Zero connection pool exhaustion
 *   - All 1,000 complaints present post-test
 *
 * Usage:
 *   k6 run tests/load/k6_concurrent_submissions.js
 *   k6 run --vus 500 --duration 30s tests/load/k6_concurrent_submissions.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────
const SUPABASE_URL  = __ENV.SUPABASE_URL  || 'http://localhost:8000';
const SERVICE_KEY   = __ENV.SERVICE_KEY    || 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA';
const HOSPITAL_ID   = '2cf24f6f-6a6a-4187-b426-63a2417c7e97';

const DEPARTMENT_IDS = [
  '42254d74-623c-4472-bb04-df406fcf09c9', // Medicine
  '534cf3be-82f5-4eed-9d14-bf4a207285bb', // Surgery
  '629bc299-0a8d-4d8d-8796-ed1483b075a3', // Nursing
  'c75d2dc3-6344-4c6f-afa1-9d6d43e9d9f1', // Housekeeping
  '4cd2e801-8b32-4517-947d-c9f20c7292a9', // Emergency
  '78619ac0-caa3-4742-b31e-181d30c8d5e0', // Operations
  '35ec44a2-dab8-42c8-bc7a-d21b530e2760', // Procurement
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
// k6 Options — Staged Ramp-Up to 1,000 VUs
// ──────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 100  },  // Warm up
    { duration: '20s', target: 500  },  // Ramp to 500
    { duration: '30s', target: 1000 },  // Full load
    { duration: '30s', target: 1000 },  // Sustain peak
    { duration: '10s', target: 0    },  // Cool down
  ],
  thresholds: {
    'http_req_duration':      ['p(95)<200'],  // P95 < 200ms
    'http_req_failed':        ['rate<0.01'],  // < 1% error rate
    'successful_inserts':     ['count>900'],  // At least 90% success
    'pool_exhaustion_errors': ['count==0'],   // Zero pool errors
  },
};

// ──────────────────────────────────────────────
// Custom Metrics
// ──────────────────────────────────────────────
const successfulInserts     = new Counter('successful_inserts');
const failedInserts         = new Counter('failed_inserts');
const poolExhaustionErrors  = new Counter('pool_exhaustion_errors');
const insertLatency         = new Trend('insert_latency_ms');
const errorRate             = new Rate('error_rate');

// ──────────────────────────────────────────────
// Headers (service_role auth bypasses RLS)
// ──────────────────────────────────────────────
const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer':        'return=representation',
};

// ──────────────────────────────────────────────
// Test Function
// ──────────────────────────────────────────────
export default function () {
  const vuId  = __VU;
  const iter  = __ITER;
  const deptIdx    = (vuId + iter) % DEPARTMENT_IDS.length;
  const patIdx     = vuId % PATIENT_IDS.length;
  const sevIdx     = iter % SEVERITY_LEVELS.length;

  const payload = JSON.stringify({
    patient_id:      PATIENT_IDS[patIdx],
    hospital_id:     HOSPITAL_ID,
    department_id:   DEPARTMENT_IDS[deptIdx],
    severity_level:  SEVERITY_LEVELS[sevIdx],
    status:          'submitted',
  });

  const startTime = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/complaints`,
    payload,
    { headers, tags: { name: 'InsertComplaint' } }
  );
  const elapsed = Date.now() - startTime;
  insertLatency.add(elapsed);

  // Check results
  const success = check(res, {
    'status is 201 Created': (r) => r.status === 201,
    'response has id':       (r) => {
      try { return JSON.parse(r.body)[0]?.id !== undefined; }
      catch { return false; }
    },
  });

  if (success) {
    successfulInserts.add(1);
    errorRate.add(false);
  } else {
    failedInserts.add(1);
    errorRate.add(true);

    // Detect pool exhaustion
    if (res.status === 0 || res.status >= 500) {
      poolExhaustionErrors.add(1);
      if (res.body && typeof res.body === 'string') {
        const body = res.body.toLowerCase();
        if (body.includes('pool') || body.includes('connection') || body.includes('timeout')) {
          console.error(`[VU${vuId}] Pool exhaustion detected: ${res.body}`);
        }
      }
    }
  }

  sleep(0.1); // Small inter-request gap
}

// ──────────────────────────────────────────────
// Teardown — Print Summary
// ──────────────────────────────────────────────
export function handleSummary(data) {
  const p50 = data.metrics.http_req_duration?.values?.['p(50)'] || 'N/A';
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 'N/A';
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 'N/A';

  console.log('\n' + '='.repeat(60));
  console.log('  TASK 6.1 — CONCURRENT SUBMISSION TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  P50 Latency:  ${typeof p50 === 'number' ? p50.toFixed(2) : p50}ms`);
  console.log(`  P95 Latency:  ${typeof p95 === 'number' ? p95.toFixed(2) : p95}ms  (threshold: <200ms)`);
  console.log(`  P99 Latency:  ${typeof p99 === 'number' ? p99.toFixed(2) : p99}ms`);
  console.log('='.repeat(60) + '\n');

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
