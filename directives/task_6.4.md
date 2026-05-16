# Task 6.4: Observability, APM & SLA Queue Monitoring

**Owner:** DevOps Engineer
**Risk:** HIGH

## Objective
Wire full OpenTelemetry instrumentation into the Next.js application, configure SigNoz custom metrics and dashboards, integrate Sentry for exception capture, and validate PagerDuty alerting on simulated failures.

## Implementation Steps

### 1. OpenTelemetry SDK Integration
- Install `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, and `@opentelemetry/exporter-trace-otlp-grpc`.
- Create `src/lib/telemetry.ts`:
  - Initialize `NodeSDK` with OTLP gRPC exporter pointing to SigNoz (`http://[signoz_host]:4317`).
  - Register auto-instrumentation for HTTP and fetch calls.
- Wire telemetry initialization into Next.js `instrumentation.ts` (App Router instrumentation hook).
- Add custom tracing spans to:
  - All Server Actions in `src/actions/` (`complaints.ts`, `workflow.ts`, `sla.ts`, `audit.ts`).
  - Inngest functions in `src/inngest/functions.ts`.
  - ALE encrypt/decrypt operations.

### 2. Custom Metrics
Configure the following SigNoz custom metrics with alert thresholds:

| Metric                         | Alert Threshold              |
|--------------------------------|------------------------------|
| `inngest.queue.depth`          | > 100 unprocessed events     |
| `sla.breach.rate`              | > 5 breaches per hour        |
| `audit_log.ledger.integrity`   | Any mismatch detected        |
| `ale.decryption.latency`       | P95 > 50ms                   |
| `server_action.error.rate`     | > 1% of total requests       |

### 3. Sentry Integration
- Install `@sentry/nextjs`.
- Configure `sentry.client.config.ts` and `sentry.server.config.ts` with DSN from `.env`.
- Wire Sentry to capture:
  - All unhandled Server Action exceptions.
  - Edge Function crashes (if applicable).
  - Inngest function failures.
- Set up source maps upload for readable stack traces.

### 4. SigNoz Dashboard
- Build a real-time SigNoz dashboard with panels for:
  - SLA queue health (Inngest queue depth over time).
  - SLA breach count (rolling 24h window).
  - Notification delivery rate (success vs failure).
  - ALE decryption latency (P50/P95/P99 histogram).
  - Server Action response times (by action name).

### 5. Elasticsearch Uptime Monitoring
- Configure SigNoz synthetic check hitting the Elasticsearch `ap-south-1` health endpoint every 5 minutes.
- If Elasticsearch is unreachable for 2 consecutive checks, trigger PagerDuty alert.
- **Pass**: PagerDuty alert fires within 10 minutes of simulated Elasticsearch downtime.

### 6. PagerDuty Alert Fire Demo
- Simulate Inngest queue overload (inject 150+ events rapidly).
- Verify `inngest.queue.depth` metric exceeds threshold in SigNoz.
- Confirm SigNoz fires alert to PagerDuty.
- **Pass**: PagerDuty incident created with correct severity and metadata.

## Deliverable
- Live SigNoz dashboard screenshot with all custom metrics populated.
- PagerDuty alert fire demo evidence (incident screenshot with timestamp).
- Sentry integration proof (captured exception in Sentry UI).
- `src/lib/telemetry.ts` and `instrumentation.ts` committed.
