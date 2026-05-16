# Task 6.1: Load & Thundering Herd Chaos Testing

**Owner:** QA Engineer + DevOps Engineer
**Risk:** CRITICAL

## Objective
Validate that the platform can sustain high-concurrency workloads — 1,000 simultaneous complaint submissions, 100 concurrent dashboard users — with P95 latency < 200ms. Simulate the Thundering Herd scenario (200 offline PWAs reconnecting simultaneously with 5 queued grievances each = 1,000 payloads) and prove zero data loss, zero duplicate SLA timers, and full sync within 10 minutes.

## Implementation Steps

### 1. Load Testing Tool Setup
- Install Grafana k6 globally: `npm install -g k6` or download binary.
- Create a `tests/load/` directory for all load test scripts.

### 2. Baseline Concurrent Submission Test
- **Script**: `tests/load/k6_concurrent_submissions.js`
  - Simulate 1,000 virtual users (VUs) each submitting a complaint via the Server Action endpoint.
  - Each payload must include valid Zod-conformant complaint data (severity, department_id, hospital_id).
  - Measure P50, P95, P99 latency.
- **Pass Criteria**:
  - P95 < 200ms.
  - Zero HTTP 5xx responses.
  - Zero Supavisor connection pool exhaustion errors in Docker logs.
  - All 1,000 complaints present in `complaints` table post-test.

### 3. Dashboard Concurrent User Test
- **Script**: `tests/load/k6_dashboard_readers.js`
  - Simulate 100 VUs querying the staff dashboard data (TanStack Table data endpoint).
  - Include mixed role JWT tokens (department_manager, quality_coordinator).
  - Validate RLS enforcement under load — no cross-department data leakage.
- **Pass Criteria**:
  - P95 < 200ms for dashboard query.
  - Zero cross-department data returned.

### 4. Thundering Herd Simulation
- **Script**: `tests/load/k6_thundering_herd.js`
  - Simulate 200 offline PWA clients each with 5 queued complaint payloads.
  - All 200 clients "reconnect" simultaneously (staggered within a 5-second burst window).
  - Each payload includes a SHA-256 deduplication hash.
- **Pass Criteria**:
  - All 1,000 payloads synced within 10 minutes.
  - Zero data loss (COUNT in `complaints` = 1,000 unique after dedup).
  - Zero duplicate SLA timers in Inngest (verify via Inngest Dev Server UI).
  - `processed_events` table shows proper idempotency — no duplicate event IDs.
- **Fail Criteria**:
  - \>5% payload failure → Sprint 6 blocker, rollback to Sprint 5.
  - Any SLA timer duplicated → Sprint 6 blocker.

### 5. Connection Pool Monitoring
- During all load tests, monitor Supavisor metrics:
  - Active connections vs pool ceiling.
  - Queue wait time.
- Capture Docker logs for connection pool exhaustion detection.

## Deliverable
- Load test report with P50/P95/P99 latency charts.
- Thundering Herd simulation pass evidence (row counts, duration, dedup check).
- Supavisor connection pool monitoring output.
- Inngest Dev Server screenshot showing zero duplicate SLA jobs.
