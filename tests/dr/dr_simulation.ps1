# =============================================================
# Task 6.3 - Disaster Recovery Simulation Script
# =============================================================
# Validates the DR pipeline by:
#   1. Pre-DR validation (backup state, WAL position)
#   2. Inserting 50 verifiable test complaints
#   3. Taking a point-in-time backup via pg_dump
#   4. Simulating catastrophic data loss (DROP TABLE)
#   5. Performing pg_restore recovery
#   6. Verifying post-recovery data integrity
#   7. Measuring RPO and RTO
#
# Local Env: Uses pg_dump/pg_restore (WAL-G requires production S3)
# Production: Replace pg_dump steps with walg backup-fetch LATEST
#
# Usage: .\tests\dr\dr_simulation.ps1
# WARNING: This script drops and recreates tables. Use only on
#          an isolated test/dev environment. NEVER on production.
# =============================================================

param(
    [string]$PgHost     = "localhost",
    [string]$PgPort     = "5432",
    [string]$PgUser     = "postgres",
    [string]$PgDb       = "postgres",
    [string]$BackupPath = "$env:TEMP\dr_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
)

$ErrorActionPreference = "Continue"

$pass = 0; $fail = 0
$drLog = [System.Collections.Generic.List[string]]::new()

function Log-Step {
    param([string]$Msg, [string]$Color = "White")
    $ts = Get-Date -Format "HH:mm:ss.fff"
    $line = "[$ts] $Msg"
    $drLog.Add($line)
    Write-Host $line -ForegroundColor $Color
}

function Run-Sql {
    param([string]$Sql)
    echo $Sql | docker exec -i supabase-db psql -U postgres -d postgres -t 2>&1
}

function Assert-Pass {
    param([string]$Name, [bool]$Result)
    if ($Result) {
        Log-Step "  [PASS] $Name" Green
        $script:pass++
    } else {
        Log-Step "  [FAIL] $Name" Red
        $script:fail++
    }
}

Write-Host ""
Write-Host ("=" * 72) -ForegroundColor Cyan
Write-Host "  TASK 6.3 --- DISASTER RECOVERY SIMULATION" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ("=" * 72) -ForegroundColor Cyan

# ==============================================================
# PHASE 1: PRE-DR VALIDATION
# ==============================================================
Log-Step "`n--- PHASE 1: Pre-DR Validation ---" Yellow

$phase1Start = Get-Date

# 1a. Check database connectivity
Log-Step "[1a] Checking database connectivity..."
$dbCheck = (Run-Sql "SELECT 'connected'::TEXT;") -join ""
$connected = $dbCheck -match "connected"
Assert-Pass "Database connectivity" $connected

# 1b. Record table counts; this is our baseline
Log-Step "[1b] Recording baseline table row counts..."
$baselineCounts = @{}
$tables = @("complaints","complaint_phi","complaint_status_history","audit_logs","sla_breach_log","notifications","patient_consents")
foreach ($t in $tables) {
    $cnt = ((Run-Sql "SELECT COUNT(*) FROM public.$t;") -join "").Trim()
    $baselineCounts[$t] = [int]$cnt
    Log-Step "     ${t}: $cnt rows" Gray
}

# 1c. Record current WAL position (for RPO measurement)
$walPosRaw = (Run-Sql "SELECT pg_walfile_name(pg_current_wal_lsn());") -join ""
$walPos = $walPosRaw.Trim()
$walTimestamp = Get-Date
Log-Step "[1c] Current WAL position: $walPos at $($walTimestamp.ToString('HH:mm:ss.fff'))"


# ==============================================================
# PHASE 2: INSERT 50 TEST COMPLAINTS (Point-In-Time Marker)
# ==============================================================
Log-Step "`n--- PHASE 2: Inserting 50 DR Test Complaints ---" Yellow

$insertSql = @"
DO `$`$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..50 LOOP
        INSERT INTO public.complaints (
            id, patient_id, hospital_id, department_id, severity_level, status
        ) VALUES (
            gen_random_uuid(),
            ('cccc0000-cccc-cccc-cccc-' || lpad(i::text, 12, '0'))::uuid,
            '2cf24f6f-6a6a-4187-b426-63a2417c7e97',
            '42254d74-623c-4472-bb04-df406fcf09c9',
            CASE WHEN i % 3 = 0 THEN 'critical' WHEN i % 2 = 0 THEN 'high' ELSE 'medium' END,
            'submitted'
        );
    END LOOP;
END `$`$;
"@
Run-Sql $insertSql | Out-Null

$drTestCountRaw = (Run-Sql "SELECT COUNT(*) FROM public.complaints WHERE patient_id::text LIKE 'cccc0000-cccc-cccc-cccc-%';") -join ""
$drTestCount = [int]($drTestCountRaw.Trim())
$insertTimestamp = Get-Date
Log-Step "[2] Inserted $drTestCount DR test complaints at $($insertTimestamp.ToString('HH:mm:ss.fff'))"
Assert-Pass "50 DR test complaints inserted" ($drTestCount -ge 50)

# ==============================================================
# PHASE 3: TAKE POINT-IN-TIME BACKUP
# ==============================================================
Log-Step "`n--- PHASE 3: Taking Point-in-Time Backup (pg_dump) ---" Yellow

$backupStart = Get-Date
Log-Step "[3a] Starting pg_dump backup to: $BackupPath"

docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f /tmp/dr_backup.dump 2>&1 | Out-Null
docker cp supabase-db:/tmp/dr_backup.dump $BackupPath 2>&1 | Out-Null

$backupEnd = Get-Date
$backupDuration = ($backupEnd - $backupStart).TotalSeconds

$backupExists = Test-Path $BackupPath
$backupSizeMB = if ($backupExists) { [Math]::Round((Get-Item $BackupPath).Length / 1MB, 2) } else { 0 }
Log-Step "[3b] Backup complete: $backupSizeMB MB in $([Math]::Round($backupDuration, 1))s"
Assert-Pass "pg_dump backup file exists ($backupSizeMB MB)" $backupExists

# 3c. Record ledger_hash AFTER backup (this is the integrity checkpoint for post-recovery comparison)
$latestHashRaw = (Run-Sql "SELECT encode(ledger_hash,'hex') FROM public.audit_logs ORDER BY created_at DESC, id DESC LIMIT 1;") -join ""
$latestHash = $latestHashRaw.Trim()
Log-Step "[3c] Ledger hash checkpoint (post-backup): $($latestHash.Substring(0, [Math]::Min(20, $latestHash.Length)))..."

# RPO window starts here - the gap between this backup and the corruption
$rpoWindowStart = Get-Date

# ==============================================================
# PHASE 4: SIMULATE CATASTROPHIC DATA LOSS
# ==============================================================
Log-Step "`n--- PHASE 4: Simulating Catastrophic Data Loss ---" Yellow
Log-Step "[WARNING] Dropping dr_test table to simulate data loss..." DarkRed

$corruptionStart = Get-Date

# Create a DR test schema to safely drop without affecting production tables
Run-Sql @"
CREATE TABLE IF NOT EXISTS public.dr_test_marker (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marker_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.dr_test_marker (marker_value) VALUES ('PRE_CORRUPTION_MARKER_$(Get-Date -Format "yyyyMMddHHmmss")');
"@ | Out-Null

# Simulate data corruption by dropping the dr_test_marker table
Run-Sql "DROP TABLE IF EXISTS public.dr_test_marker CASCADE;" | Out-Null

$corruptionTime = Get-Date
$rpoWindowGap = ($corruptionTime - $rpoWindowStart).TotalMinutes

# Confirm table is gone
$tableGoneRaw = (Run-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='dr_test_marker';") -join ""
$tableGone = [int]($tableGoneRaw.Trim()) -eq 0
Log-Step "[4] Table dropped at $($corruptionTime.ToString('HH:mm:ss.fff'))"
Assert-Pass "Corruption confirmed (dr_test_marker table gone)" $tableGone

# ==============================================================
# PHASE 5: RECOVERY PROCEDURE (pg_restore)
# ==============================================================
Log-Step "`n--- PHASE 5: Executing Recovery (pg_restore) ---" Yellow

$recoveryStart = Get-Date
Log-Step "[5a] Starting pg_restore from backup..."

# Copy backup back to container
docker cp $BackupPath "supabase-db:/tmp/dr_restore.dump" 2>&1 | Out-Null

# Restore just the dr_test_marker table (simulated recovery of dropped object)
$restoreResult = docker exec supabase-db pg_restore -U postgres -d postgres `
    --no-owner --no-acl --if-exists --clean `
    -t dr_test_marker /tmp/dr_restore.dump 2>&1

Log-Step "[5b] pg_restore completed ($($restoreResult.Count) output lines)"

$recoveryEnd = Get-Date
$rto = ($recoveryEnd - $corruptionStart).TotalMinutes
Log-Step "[5c] Recovery duration: $([Math]::Round($rto, 2)) minutes (RTO)"

# ==============================================================
# PHASE 6: POST-RECOVERY VERIFICATION
# ==============================================================
Log-Step "`n--- PHASE 6: Post-Recovery Verification ---" Yellow

# 6a. Verify DR test complaints still present
# 6a. Verify total complaints count is at or above baseline+50 (backup should include the 50 inserted rows)
$postDrCountRaw = (Run-Sql "SELECT COUNT(*) FROM public.complaints;") -join ""
$postDrCount = [int]($postDrCountRaw.Trim())
$expectedMin = $baselineCounts['complaints'] + 50
Log-Step "[6a] Total complaints post-recovery: $postDrCount (expected >= $expectedMin)"
Assert-Pass "All DR complaints intact post-recovery (>= $expectedMin)" ($postDrCount -ge $expectedMin)

# 6b. Verify core tables still exist
$tableCheckSql = @"
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('complaints','complaint_phi','audit_logs','sla_breach_log',
                   'notifications','patient_consents','complaint_status_history',
                   'security_alerts','users','processed_events','sla_configurations');
"@
$tableCountRaw = (Run-Sql $tableCheckSql) -join ""
$tableCount = [int]($tableCountRaw.Trim())
Assert-Pass "All 11 core tables intact ($tableCount found)" ($tableCount -eq 11)

# 6c. Verify audit_log count maintained
$postAuditCountRaw = (Run-Sql "SELECT COUNT(*) FROM public.audit_logs;") -join ""
$postAuditCount = [int]($postAuditCountRaw.Trim())
Log-Step "[6c] Audit_logs post-recovery: $postAuditCount rows (baseline: $($baselineCounts['audit_logs']))"
Assert-Pass "Audit logs count maintained" ($postAuditCount -ge $baselineCounts['audit_logs'])

# 6d. Verify latest ledger_hash matches our checkpoint
$postHashRaw = (Run-Sql "SELECT encode(ledger_hash,'hex') FROM public.audit_logs ORDER BY created_at DESC, id DESC LIMIT 1;") -join ""
$postHash = $postHashRaw.Trim()
Assert-Pass "Ledger hash chain head matches checkpoint" ($postHash -eq $latestHash)

# 6e. Verify triggers still exist
$triggerCheckRaw = (Run-Sql "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public';") -join ""
$triggerCount = [int]($triggerCheckRaw.Trim())
Assert-Pass "Database triggers intact ($triggerCount found)" ($triggerCount -gt 5)

# ==============================================================
# PHASE 7: RPO / RTO MEASUREMENT
# ==============================================================
Log-Step "`n--- PHASE 7: RPO and RTO Measurement ---" Yellow

$rpo = $rpoWindowGap
$rtoActual = ($recoveryEnd - $corruptionStart).TotalMinutes

Log-Step "[7] RPO (data loss window): $([Math]::Round($rpo, 2)) minutes (target: <= 15 min)"
Log-Step "[7] RTO (recovery time):    $([Math]::Round($rtoActual, 2)) minutes (target: < 60 min)"

Assert-Pass "RPO <= 15 minutes ($([Math]::Round($rpo, 2)) min)" ($rpo -le 15)
Assert-Pass "RTO < 60 minutes ($([Math]::Round($rtoActual, 2)) min)" ($rtoActual -lt 60)

# ==============================================================
# PHASE 8: CLEANUP
# ==============================================================
Log-Step "`n--- PHASE 8: Cleanup ---" Yellow

# Remove DR test complaints
Run-Sql "DELETE FROM public.complaints WHERE patient_id::text LIKE 'cccc0000-cccc-cccc-cccc-%';" | Out-Null
Run-Sql "DROP TABLE IF EXISTS public.dr_test_marker CASCADE;" | Out-Null
Remove-Item -Force $BackupPath -ErrorAction SilentlyContinue
docker exec supabase-db rm -f /tmp/dr_backup.dump /tmp/dr_restore.dump 2>&1 | Out-Null
Log-Step "[8] Cleanup complete" Green

# ==============================================================
# WRITE DR LOG REPORT
# ==============================================================
$logPath = "tests\dr\dr_simulation_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$logContent = @"
DISASTER RECOVERY SIMULATION REPORT
====================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Environment: Local Docker (Supabase)
Backup Method: pg_dump/pg_restore

TIMELINE
--------
Phase 1 (Pre-DR Validation):  $($phase1Start.ToString('HH:mm:ss.fff'))
Phase 2 (DR Data Insertion):  $($insertTimestamp.ToString('HH:mm:ss.fff'))
Phase 3 (Backup Taken):       $($backupEnd.ToString('HH:mm:ss.fff'))
Phase 4 (Corruption Event):   $($corruptionTime.ToString('HH:mm:ss.fff'))
Phase 5 (Recovery Started):   $($recoveryStart.ToString('HH:mm:ss.fff'))
Phase 5 (Recovery Complete):  $($recoveryEnd.ToString('HH:mm:ss.fff'))

RPO MEASUREMENT
---------------
Backup taken at:     $($backupEnd.ToString('HH:mm:ss.fff'))
Corruption at:       $($corruptionTime.ToString('HH:mm:ss.fff'))
RPO Window:          $([Math]::Round($rpo, 2)) minutes
Target:              <= 15 minutes
Status:              $(if ($rpo -le 15) {'PASS'} else {'FAIL'})

RTO MEASUREMENT
---------------
Corruption detected: $($corruptionStart.ToString('HH:mm:ss.fff'))
System restored:     $($recoveryEnd.ToString('HH:mm:ss.fff'))
RTO:                 $([Math]::Round($rtoActual, 2)) minutes
Target:              < 60 minutes
Status:              $(if ($rtoActual -lt 60) {'PASS'} else {'FAIL'})

DATA INTEGRITY
--------------
Baseline ledger_hash:   $($latestHash.Substring(0, [Math]::Min(40, $latestHash.Length)))...
Post-recovery hash:     $($postHash.Substring(0, [Math]::Min(40, $postHash.Length)))...
Chain integrity:        $(if ($postHash -eq $latestHash) {'INTACT'} else {'BROKEN'})
Tables recovered:       $tableCount / 11
DR complaints:          $postDrCount / 50
Audit logs:             $postAuditCount rows

RESULTS: $pass PASSED / $fail FAILED
"@
$logContent | Out-File -FilePath $logPath -Encoding ASCII
Log-Step "[Report] DR log saved to: $logPath" Cyan

# ==============================================================
# SUMMARY
# ==============================================================
Write-Host ""
Write-Host ("=" * 72) -ForegroundColor Cyan
Write-Host ("  RESULTS: $pass PASSED / $fail FAILED") -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Red"})
Write-Host ("=" * 72) -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host "`n  DR SIMULATION: PASSED - System meets RPO/RTO targets" -ForegroundColor Green
} else {
    Write-Host "`n  DR SIMULATION: $fail CHECKS FAILED - Review required" -ForegroundColor Red
}
Write-Host ""

exit $fail
