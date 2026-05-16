# Sprint 6 Verification Script
# Purpose: Automated pre-sign-off checks for Sprint 6 deliverables
# Run: .\directives\sprint_6_verification.ps1 from project root

param(
    [string]$SupabaseHost = "localhost",
    [string]$SupabasePort = "5432",
    [string]$SupabaseDb   = "postgres",
    [string]$SupabaseUser = "postgres",
    [string]$SupabasePass = $env:POSTGRES_PASSWORD,
    [string]$SigNozHost   = "localhost:3301",
    [string]$NextHost     = "localhost:3000"
)

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0
$total = 0

function Test-Check {
    param([string]$Name, [scriptblock]$Check)
    $script:total++
    try {
        $result = & $Check
        if ($result) {
            Write-Host "  [PASS] $Name" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  [FAIL] $Name" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "  [FAIL] $Name — Error: $_" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-Sql {
    param([string]$Query)
    $env:PGPASSWORD = $SupabasePass
    $result = psql -h $SupabaseHost -p $SupabasePort -U $SupabaseUser -d $SupabaseDb -t -A -c $Query 2>$null
    return $result.Trim()
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  SPRINT 6 — DELIVERABLE VERIFICATION SCRIPT" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "=" * 70 -ForegroundColor Cyan

# ==============================================================
# SECTION 1: Data Readiness (Prerequisites)
# ==============================================================
Write-Host "`n--- Section 1: Data Readiness ---" -ForegroundColor Yellow

Test-Check "Complaints table has 200+ records" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.complaints;"
    [int]$count -ge 200
}

Test-Check "SLA breach log has 50+ records" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.sla_breach_log;"
    [int]$count -ge 50
}

Test-Check "Patient consents has 100+ records" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.patient_consents;"
    [int]$count -ge 100
}

Test-Check "Notifications table has records" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.notifications;"
    [int]$count -gt 0
}

Test-Check "Golden complaint exists (Task 6.5)" {
    $status = Invoke-Sql "SELECT status FROM public.complaints WHERE id = 'aaaaaaaa-0000-1111-2222-333333333333';"
    $status -eq "closed"
}

Test-Check "Golden complaint has full lifecycle history" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.complaint_status_history WHERE complaint_id = 'aaaaaaaa-0000-1111-2222-333333333333';"
    [int]$count -ge 6
}

Test-Check "Golden complaint has consent record" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.patient_consents WHERE complaint_id = 'aaaaaaaa-0000-1111-2222-333333333333';"
    [int]$count -ge 1
}

Test-Check "Golden complaint has CAPA sign-off in audit_logs" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.audit_logs WHERE record_id = 'aaaaaaaa-0000-1111-2222-333333333333' AND action_type = 'CAPA_SIGN_CLOSE';"
    [int]$count -ge 1
}

Test-Check "Cross-tenant Hospital B exists (Task 6.2)" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.hospitals WHERE id = 'b8f35e7a-1234-4abc-def0-111122223333';"
    [int]$count -ge 1
}

# ==============================================================
# SECTION 2: Audit Log Integrity (Task 6.2, 6.3, 6.5)
# ==============================================================
Write-Host "`n--- Section 2: Audit Log Integrity ---" -ForegroundColor Yellow

Test-Check "Audit logs table has records" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.audit_logs;"
    [int]$count -gt 0
}

Test-Check "Security alerts table exists and is queryable" {
    $count = Invoke-Sql "SELECT COUNT(*) FROM public.security_alerts;"
    $null -ne $count
}

# ==============================================================
# SECTION 3: Infrastructure Readiness
# ==============================================================
Write-Host "`n--- Section 3: Infrastructure Readiness ---" -ForegroundColor Yellow

Test-Check "PostgreSQL is reachable" {
    $result = Invoke-Sql "SELECT 1;"
    $result -eq "1"
}

Test-Check "Next.js dev server is running" {
    try {
        $response = Invoke-WebRequest -Uri "http://$NextHost" -UseBasicParsing -TimeoutSec 5
        $response.StatusCode -eq 200
    } catch { $false }
}

Test-Check "SigNoz is reachable" {
    try {
        $response = Invoke-WebRequest -Uri "http://$SigNozHost" -UseBasicParsing -TimeoutSec 5
        $response.StatusCode -eq 200 -or $response.StatusCode -eq 302
    } catch { $false }
}

# ==============================================================
# SECTION 4: Application Build Integrity
# ==============================================================
Write-Host "`n--- Section 4: Application Build Integrity ---" -ForegroundColor Yellow

Test-Check "TypeScript compiles without errors" {
    $output = pnpm exec tsc --noEmit 2>&1
    $LASTEXITCODE -eq 0
}

Test-Check "OpenTelemetry telemetry.ts exists" {
    Test-Path "src/lib/telemetry.ts"
}

Test-Check "Instrumentation hook exists" {
    Test-Path "src/instrumentation.ts"
}

# ==============================================================
# SECTION 5: Security Artifacts (Task 6.2)
# ==============================================================
Write-Host "`n--- Section 5: Security Artifacts ---" -ForegroundColor Yellow

Test-Check "Pen test script exists" {
    Test-Path "tests/security/pen_test_suite.ps1"
}

Test-Check "Ledger tamper test script exists" {
    Test-Path "tests/security/ledger_tamper_test.ps1"
}

# ==============================================================
# SECTION 6: Load Test Artifacts (Task 6.1)
# ==============================================================
Write-Host "`n--- Section 6: Load Test Artifacts ---" -ForegroundColor Yellow

Test-Check "k6 concurrent submissions script exists" {
    Test-Path "tests/load/k6_concurrent_submissions.js"
}

Test-Check "k6 dashboard readers script exists" {
    Test-Path "tests/load/k6_dashboard_readers.js"
}

Test-Check "k6 thundering herd script exists" {
    Test-Path "tests/load/k6_thundering_herd.js"
}

# ==============================================================
# SECTION 7: DR Test Artifacts (Task 6.3)
# ==============================================================
Write-Host "`n--- Section 7: DR Test Artifacts ---" -ForegroundColor Yellow

Test-Check "DR simulation script exists" {
    Test-Path "tests/dr/dr_simulation.ps1"
}

# ==============================================================
# SECTION 8: Materialised Views (Sprint 5 prerequisite)
# ==============================================================
Write-Host "`n--- Section 8: Materialised Views Check ---" -ForegroundColor Yellow

$mvNames = @(
    'mv_avg_resolution_time',
    'mv_monthly_complaint_trends',
    'mv_sla_compliance_percentage',
    'mv_department_heatmap',
    'mv_capa_effectiveness',
    'mv_org_sla_compliance',
    'mv_org_complaint_trends',
    'mv_org_resolution_benchmarks'
)

foreach ($mv in $mvNames) {
    Test-Check "Materialised view '$mv' exists" {
        $result = Invoke-Sql "SELECT COUNT(*) FROM pg_matviews WHERE matviewname = '$mv';"
        [int]$result -ge 1
    }
}

# ==============================================================
# SUMMARY
# ==============================================================
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  RESULTS: $pass PASSED / $fail FAILED / $total TOTAL" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "=" * 70 -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host "`n  Sprint 6 verification: ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "  Ready for Sprint 7 kickoff." -ForegroundColor Green
} else {
    Write-Host "`n  Sprint 6 verification: $fail CHECK(S) FAILED" -ForegroundColor Red
    Write-Host "  Address failures before Sprint 7." -ForegroundColor Red
}

Write-Host ""
exit $fail
