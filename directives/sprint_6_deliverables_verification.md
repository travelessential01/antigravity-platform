# Sprint 6 Deliverables Verification

To confirm Sprint 6 is ready for sign-off, verify the following deliverables:

### 1. Load & Thundering Herd Chaos Testing (Task 6.1)
- [ ] k6 baseline test completes: 1,000 concurrent submissions with P95 < 200ms.
- [ ] k6 dashboard test completes: 100 concurrent readers with zero cross-department data leakage.
- [ ] Thundering Herd simulation: 200 x 5 = 1,000 payloads sync within 10 minutes.
- [ ] Zero data loss confirmed (row count matches expected unique payloads).
- [ ] Zero duplicate SLA timers in Inngest (screenshot from Dev Server UI).
- [ ] Supavisor connection pool NOT exhausted during any test.

### 2. Security & Privacy Penetration Testing (Task 6.2)
- [ ] All SQL injection payloads rejected by Zod validation (zero bypasses).
- [ ] ALE bypass tests: Patient cross-access returns 403; Manager cross-department returns 403; Cross-tenant returns zero rows.
- [ ] Role escalation: Quality Coordinator JWT calling Admin endpoints returns 403.
- [ ] IDOR SAST scan (`semgrep`) returns zero violations.
- [ ] HIPAA Minimum Necessary: Dashboard shows zero PHI without modal; notifications contain zero PHI.
- [ ] Cryptographic Ledger Tamper: `UPDATE audit_logs` triggers `security_alerts` INSERT + SigNoz webhook + PagerDuty incident within 60 seconds.
- [ ] Deep-link replay: Used token returns 403 with "token already consumed".

### 3. Disaster Recovery Simulation (Task 6.3)
- [ ] `walg backup-list` shows at least one full backup and continuous WAL stream.
- [ ] `walg wal-verify timeline` confirms zero WAL gaps.
- [ ] DR simulation: DROP TABLE → WAL-G restore → all 50 test complaints recovered intact.
- [ ] `ledger_hash` chain verified unbroken post-recovery.
- [ ] RPO ≤ 15 minutes proven with timestamps.
- [ ] RTO < 1 hour proven with timestamps.
- [ ] Elasticsearch `audit_reads` queryable during DB outage window.

### 4. Observability, APM & SLA Queue Monitoring (Task 6.4)
- [ ] `@opentelemetry/sdk-node` installed and `src/lib/telemetry.ts` committed.
- [ ] `src/instrumentation.ts` wired into Next.js App Router.
- [ ] All Server Actions and Inngest functions emit OTLP spans visible in SigNoz.
- [ ] Custom metrics configured: `inngest.queue.depth`, `sla.breach.rate`, `audit_log.ledger.integrity`, `ale.decryption.latency`.
- [ ] SigNoz dashboard live with all panels.
- [ ] Sentry integration operational — captured test exception visible in Sentry UI.
- [ ] PagerDuty alert fires on simulated Inngest queue overload.
- [ ] Elasticsearch uptime synthetic check operational (5-min interval).

### 5. JCI/NABH Mock Surveyor Dry Run (Task 6.5)
- [ ] Golden complaint record seeded and traverses full lifecycle through CAPA closure.
- [ ] Non-developer completes all 7 steps in < 10 minutes total.
- [ ] No individual step exceeds 2 minutes.
- [ ] Zero developer assistance required during the dry run.
- [ ] Zero navigation errors during the dry run.
- [ ] Screen recording of the complete dry run captured and archived.
- [ ] Surveyor Dry Run Pass Certificate signed by Compliance Engineer.
