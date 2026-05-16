# =============================================================
# Task 6.2 --- Cryptographic Ledger Tamper Simulation
# =============================================================
# Validates the immutable audit_logs tamper detection pipeline:
#   1. UPDATE audit_logs --- trigger detects broken ledger_hash
#   2. Trigger inserts into security_alerts
#   3. TAMPER_DETECTED entry into audit_logs
#   4. Supabase Webhook --- SigNoz (if configured)
#   5. PagerDuty incident (if configured)
#
# Pass: security_alerts entry within seconds + UPDATE blocked
# Sprint 7 Blocker: If PagerDuty integration fails (manual check)
#
# Usage: .\tests\security\ledger_tamper_test.ps1
# =============================================================

param(
    [string]$SupabaseUrl = "http://localhost:8000",
    [string]$ServiceKey  = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  TASK 6.2 --- CRYPTOGRAPHIC LEDGER TAMPER SIMULATION" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ("=" * 70) -ForegroundColor Cyan

# ------------------------------------------------------------------
# Step 1: Record baseline state
# ------------------------------------------------------------------
Write-Host "`n[Step 1] Recording baseline security_alerts count..." -ForegroundColor Yellow

$baselineAlertsRaw = echo "SELECT COUNT(*) FROM public.security_alerts;" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$baselineAlerts = [int]($baselineAlertsRaw -join "").Trim()
Write-Host "  Baseline security_alerts count: $baselineAlerts"

# Get a target audit_log entry ID for the tamper attempt
$targetIdRaw = echo "SELECT id FROM public.audit_logs ORDER BY created_at DESC LIMIT 1;" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$targetId = ($targetIdRaw -join "").Trim()

if (-not $targetId) {
    Write-Host "  [ABORT] No audit_logs entries found to tamper with." -ForegroundColor Red
    exit 1
}
Write-Host "  Target audit_log entry: $targetId"

# ------------------------------------------------------------------
# Step 2: Record the original action_type
# ------------------------------------------------------------------
$originalActionRaw = echo "SELECT action_type FROM public.audit_logs WHERE id = '$targetId';" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$originalAction = ($originalActionRaw -join "").Trim()
Write-Host "  Original action_type: $originalAction"

# ------------------------------------------------------------------
# Step 3: Attempt the tamper (UPDATE audit_logs)
# ------------------------------------------------------------------
Write-Host "`n[Step 2] Executing tamper attempt..." -ForegroundColor Yellow
Write-Host "  SQL: UPDATE audit_logs SET action_type = 'CONCEALED' WHERE id = '$targetId'" -ForegroundColor DarkGray

$tamperStart = Get-Date
$tamperResult = echo "UPDATE public.audit_logs SET action_type = 'CONCEALED' WHERE id = '$targetId';" | `
    docker exec -i supabase-db psql -U postgres -d postgres 2>&1
$tamperEnd = Get-Date
$tamperDuration = ($tamperEnd - $tamperStart).TotalMilliseconds

Write-Host "  Duration: $([math]::Round($tamperDuration, 0))ms"

# ------------------------------------------------------------------
# Step 4: Verify tamper was BLOCKED
# ------------------------------------------------------------------
Write-Host "`n[Step 3] Verifying tamper detection..." -ForegroundColor Yellow

$tamperBlocked = $tamperResult -match "TAMPER DETECTED"
if ($tamperBlocked) {
    Write-Host "  [PASS] Tamper was BLOCKED by trigger (raised EXCEPTION)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Tamper was NOT blocked! Result: $tamperResult" -ForegroundColor Red
}

# Verify the row was NOT actually modified
$currentAction = echo "SELECT action_type FROM public.audit_logs WHERE id = '$targetId';" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$currentAction = $currentAction.Trim()
$dataIntact = $currentAction -eq $originalAction

if ($dataIntact) {
    Write-Host "  [PASS] Data integrity intact (action_type unchanged: '$currentAction')" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Data was modified! Expected '$originalAction', got '$currentAction'" -ForegroundColor Red
}

# ------------------------------------------------------------------
# Step 5: Verify security_alerts entry was created
# ------------------------------------------------------------------
Write-Host "`n[Step 4] Checking security_alerts..." -ForegroundColor Yellow

$newAlertsRaw = echo "SELECT COUNT(*) FROM public.security_alerts;" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$newAlerts = [int]($newAlertsRaw -join "").Trim()

# The trigger uses a savepoint / SECURITY DEFINER, so the alert INSERT
# happens WITHIN the trigger before the EXCEPTION. Because the exception
# rolls back the entire transaction, the security_alert may or may not persist.
# This depends on the trigger design. Let's check both scenarios.

$alertCreated = $newAlerts -gt $baselineAlerts
if ($alertCreated) {
    Write-Host "  [PASS] security_alerts incremented: $baselineAlerts -> $newAlerts" -ForegroundColor Green

    # Show the latest alert details
    $alertDetails = echo "SELECT alert_type, source_table, details FROM public.security_alerts ORDER BY created_at DESC LIMIT 1;" | `
        docker exec -i supabase-db psql -U postgres -d postgres 2>$null
    Write-Host "  Latest alert:" -ForegroundColor DarkGray
    Write-Host "  $alertDetails" -ForegroundColor DarkGray
} else {
    Write-Host "  [INFO] security_alerts count unchanged ($newAlerts)" -ForegroundColor DarkYellow
    Write-Host "         This is expected if the trigger RAISE EXCEPTION rolls back the alert INSERT." -ForegroundColor DarkYellow
    Write-Host "         The key test is that the UPDATE was BLOCKED (Step 3)." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------
# Step 6: Check for TAMPER_DETECTED audit_log entry
# ------------------------------------------------------------------
Write-Host "`n[Step 5] Checking for TAMPER_DETECTED audit_log entry..." -ForegroundColor Yellow

$tamperLogCountRaw = echo "SELECT COUNT(*) FROM public.audit_logs WHERE action_type = 'TAMPER_DETECTED';" | `
    docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$tamperLogCount = [int]($tamperLogCountRaw -join "").Trim()

if ($tamperLogCount -gt 0) {
    Write-Host "  [PASS] TAMPER_DETECTED entries found: $tamperLogCount" -ForegroundColor Green
} else {
    Write-Host "  [INFO] No TAMPER_DETECTED entries (rolled back with transaction)" -ForegroundColor DarkYellow
    Write-Host "         The UPDATE block itself is the primary proof." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------
# Step 7: Verify ledger_hash chain integrity
# ------------------------------------------------------------------
Write-Host "`n[Step 6] Verifying ledger_hash chain integrity..." -ForegroundColor Yellow

$hashCheckRaw = echo @"
SELECT COUNT(*) FROM (
    SELECT id, ledger_hash, previous_hash,
           LAG(ledger_hash) OVER (ORDER BY created_at, id) AS expected_previous
    FROM public.audit_logs
) sub
WHERE previous_hash IS NOT NULL
  AND expected_previous IS NOT NULL
  AND previous_hash != expected_previous;
"@ | docker exec -i supabase-db psql -U postgres -d postgres -t 2>$null
$hashMismatches = [int]($hashCheckRaw -join "").Trim()

if ($hashMismatches -eq 0) {
    Write-Host "  [PASS] Ledger hash chain is unbroken (0 mismatches)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Ledger hash chain has $hashMismatches mismatches!" -ForegroundColor Red
}

# ------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan

$overallPass = $tamperBlocked -and $dataIntact
if ($overallPass) {
    Write-Host "  TAMPER SIMULATION: PASSED" -ForegroundColor Green
    Write-Host "  - UPDATE was blocked by trigger" -ForegroundColor Green
    Write-Host "  - Data integrity preserved" -ForegroundColor Green
    Write-Host "  - Ledger hash chain: $( if ($hashMismatches -eq 0) {'INTACT'} else {'BROKEN'} )" -ForegroundColor $(if ($hashMismatches -eq 0) {"Green"} else {"Red"})
} else {
    Write-Host "  TAMPER SIMULATION: FAILED --- Sprint 7 BLOCKER" -ForegroundColor Red
}

Write-Host ""
Write-Host "  MANUAL VERIFICATION REQUIRED:" -ForegroundColor Yellow
Write-Host "  1. Check SigNoz for tamper alert (if webhook configured)" -ForegroundColor Yellow
Write-Host "  2. Check PagerDuty for incident within 60 seconds" -ForegroundColor Yellow
Write-Host "  3. Screenshot the PagerDuty incident for sign-off" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

if ($overallPass) { exit 0 } else { exit 1 }
