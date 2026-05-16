# Task 6.3: Disaster Recovery Simulation

**Owner:** DevOps Engineer
**Risk:** HIGH

## Objective
Validate the WAL-G Point-in-Time Recovery (PITR) pipeline by simulating a catastrophic database failure, performing a full restore, and proving data integrity with RPO ≤ 15 minutes and RTO < 1 hour.

## Implementation Steps

### 1. Pre-DR Validation
- Run `walg backup-list` and confirm:
  - At least one full base backup exists.
  - Continuous WAL stream is archiving to `ap-south-1` S3 bucket.
- Run `walg wal-verify timeline` to confirm zero WAL gaps.
- Record current WAL position and timestamp.

### 2. Insert Test Dataset
- Insert 50 test complaints with known, verifiable data points.
- Record exact insertion timestamps for each batch.
- Verify `audit_logs` has corresponding entries with intact `ledger_hash` chain.
- Note the latest `ledger_hash` value as the integrity checkpoint.

### 3. Simulate Catastrophic Corruption
- **CRITICAL**: Perform this on an **isolated test environment only** — never on production data.
- Execute: `DROP TABLE audit_logs CASCADE;`
- Confirm PostgreSQL reports the table as missing.
- Verify the application returns errors when accessing audit-dependent features.

### 4. WAL-G Recovery Procedure
1. Stop PostgreSQL service.
2. Execute: `walg backup-fetch $PGDATA LATEST` to restore the latest base backup.
3. Configure `recovery.conf` (or `postgresql.auto.conf` for PG12+) with:
   - `restore_command = 'walg wal-fetch %f %p'`
   - `recovery_target_time = '[timestamp from Step 2]'`
   - `recovery_target_action = 'promote'`
4. Start PostgreSQL — WAL replay begins automatically.
5. Monitor recovery logs for completion.

### 5. Post-Recovery Verification
- **Data Integrity**: All 50 test complaints must be present with correct data.
- **Audit Chain**: `audit_logs` table restored; run `ledger_hash` chain verification query — chain must be unbroken.
- **Schema Integrity**: All 14 tables, indexes, triggers, and RLS policies intact.
- **Application Health**: Staff dashboard loads; SLA engine responds; PHI modal decryption works.

### 6. RPO/RTO Measurement
- **RPO**: Calculate the time delta between the last WAL segment archived and the corruption event. Must be ≤ 15 minutes.
- **RTO**: Record wall-clock time from corruption detection to full system operational. Must be < 1 hour.

### 7. Elasticsearch Independence Verification
- During the DB outage window (Step 3), query the DPO Investigator UI.
- `audit_reads` in Elasticsearch (`ap-south-1`) must be queryable independently of PostgreSQL.
- **Pass**: DPO can retrieve read-audit logs even while DB is down.

## Deliverable
- DR simulation log with precise timestamps for each step.
- `walg backup-list` screenshot showing backup history.
- `walg wal-verify timeline` output confirming zero gaps.
- RPO ≤ 15 min and RTO < 1 hour proven with timestamps.
- Post-recovery `ledger_hash` chain verification query output.
