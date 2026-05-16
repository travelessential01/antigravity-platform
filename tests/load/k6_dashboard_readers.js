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

const SUPABASE_URL = requiredEnv('SUPABASE_URL');
const ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const STAFF_JWTS = JSON.parse(requiredEnv('TEST_STAFF_JWTS_JSON'));
const RUN_ID = __ENV.TEST_RUN_ID || `k6-dashboard-${Date.now()}`;

export const options = {
  stages: [
    { duration: '5s', target: Number(__ENV.K6_WARMUP_VUS || 25) },
    { duration: '10s', target: Number(__ENV.K6_RAMP_VUS || 50) },
    { duration: '20s', target: Number(__ENV.K6_PEAK_VUS || 100) },
    { duration: '30s', target: Number(__ENV.K6_PEAK_VUS || 100) },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    successful_reads: ['count>0'],
    cross_dept_leaks: ['count==0'],
    http_5xx: ['count==0'],
  },
};

const queryLatency = new Trend('dashboard_query_latency_ms');
const successfulReads = new Counter('successful_reads');
const failedReads = new Counter('failed_reads');
const crossDeptLeaks = new Counter('cross_dept_leaks');
const http5xx = new Counter('http_5xx');
const errorRate = new Rate('dashboard_error_rate');

export default function () {
  const config = STAFF_JWTS[__VU % STAFF_JWTS.length];
  const headers = {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${config.jwt}`,
    'x-test-run-id': RUN_ID,
  };

  const queryParams = [
    'select=id,created_at,updated_at,status,severity_level,sla_deadline,department_id,departments(name)',
    'deleted_at=is.null',
    'status=not.in.(closed)',
    'order=sla_deadline.asc',
    'limit=50',
  ].join('&');

  const started = Date.now();
  const res = http.get(`${SUPABASE_URL}/rest/v1/complaints?${queryParams}`, {
    headers,
    tags: { name: 'DashboardFetch', run_id: RUN_ID },
  });
  queryLatency.add(Date.now() - started);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response is array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    successfulReads.add(1);
    errorRate.add(false);
    const data = JSON.parse(res.body);
    if (config.departmentId && data.some((row) => row.department_id && row.department_id !== config.departmentId)) {
      crossDeptLeaks.add(1);
    }
  } else {
    failedReads.add(1);
    errorRate.add(true);
    if (res.status >= 500) {
      http5xx.add(1);
    }
  }

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  const values = data.metrics.http_req_duration?.values || {};
  const summary = {
    runId: RUN_ID,
    p95: values['p(95)'],
    p99: values['p(99)'],
    httpFailureRate: data.metrics.http_req_failed?.values?.rate,
    successfulReads: data.metrics.successful_reads?.values?.count,
    failedReads: data.metrics.failed_reads?.values?.count,
    http5xx: data.metrics.http_5xx?.values?.count,
    crossDeptLeaks: data.metrics.cross_dept_leaks?.values?.count,
  };

  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`,
    [`tests/load/results/${RUN_ID}.json`]: JSON.stringify({ summary, raw: data }, null, 2),
  };
}
