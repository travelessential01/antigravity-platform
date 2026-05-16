import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

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
const RUN_ID = __ENV.TEST_RUN_ID || `k6-submissions-${Date.now()}`;
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

export const options = {
  stages: [
    { duration: __ENV.K6_WARMUP || '10s', target: Number(__ENV.K6_WARMUP_VUS || 100) },
    { duration: __ENV.K6_RAMP || '20s', target: Number(__ENV.K6_RAMP_VUS || 500) },
    { duration: __ENV.K6_PEAK_RAMP || '30s', target: Number(__ENV.K6_PEAK_VUS || 1000) },
    { duration: __ENV.K6_SUSTAIN || '30s', target: Number(__ENV.K6_PEAK_VUS || 1000) },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    successful_inserts: ['count>900'],
    pool_exhaustion_errors: ['count==0'],
    http_5xx: ['count==0'],
  },
};

const successfulInserts = new Counter('successful_inserts');
const failedInserts = new Counter('failed_inserts');
const poolExhaustionErrors = new Counter('pool_exhaustion_errors');
const http5xx = new Counter('http_5xx');
const insertLatency = new Trend('insert_latency_ms');
const errorRate = new Rate('submission_error_rate');

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: 'return=representation',
  'x-test-run-id': RUN_ID,
};

export default function () {
  const deptId = DEPARTMENT_IDS[(__VU + __ITER) % DEPARTMENT_IDS.length];
  const patientId = PATIENT_IDS[__VU % PATIENT_IDS.length];
  const severity = SEVERITY_LEVELS[__ITER % SEVERITY_LEVELS.length];

  const payload = JSON.stringify({
    patient_id: patientId,
    hospital_id: HOSPITAL_ID,
    department_id: deptId,
    severity_level: severity,
    status: 'submitted',
  });

  const started = Date.now();
  const res = http.post(`${SUPABASE_URL}/rest/v1/complaints`, payload, {
    headers,
    tags: { name: 'InsertComplaint', run_id: RUN_ID },
  });
  insertLatency.add(Date.now() - started);

  const ok = check(res, {
    'status is 201 Created': (r) => r.status === 201,
    'response has id': (r) => {
      try {
        return JSON.parse(r.body)[0]?.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    successfulInserts.add(1);
    errorRate.add(false);
  } else {
    failedInserts.add(1);
    errorRate.add(true);
    if (res.status >= 500) {
      http5xx.add(1);
    }
    const body = String(res.body || '').toLowerCase();
    if (res.status === 0 || body.includes('pool') || body.includes('connection') || body.includes('timeout')) {
      poolExhaustionErrors.add(1);
    }
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const values = data.metrics.http_req_duration?.values || {};
  const summary = {
    runId: RUN_ID,
    p95: values['p(95)'],
    p99: values['p(99)'],
    httpFailureRate: data.metrics.http_req_failed?.values?.rate,
    successfulInserts: data.metrics.successful_inserts?.values?.count,
    failedInserts: data.metrics.failed_inserts?.values?.count,
    http5xx: data.metrics.http_5xx?.values?.count,
    poolExhaustionErrors: data.metrics.pool_exhaustion_errors?.values?.count,
  };

  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`,
    [`tests/load/results/${RUN_ID}.json`]: JSON.stringify({ summary, raw: data }, null, 2),
  };
}
