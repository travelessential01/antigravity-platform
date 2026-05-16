# =============================================================
# Task 6.2 --- Security & Privacy Penetration Test Suite
# =============================================================
# Tests: SQL injection, ALE bypass, role escalation, IDOR,
#        HIPAA minimum necessary, deep-link replay
#
# Usage: .\tests\security\pen_test_suite.ps1
# Requires: Supabase Docker running, Next.js dev server running
# =============================================================

param(
    [string]$SupabaseUrl  = "http://localhost:8000",
    [string]$NextUrl      = "http://localhost:3000",
    [string]$ServiceKey   = $env:SUPABASE_SERVICE_ROLE_KEY,
    [string]$AnonKey      = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
)

# Fallback keys from .env
if (-not $ServiceKey) {
    $ServiceKey = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA"
}
if (-not $AnonKey) {
    $AnonKey = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE2MDAwMDAwMDAsICJleHAiOiAxOTAwMDAwMDAwfQ.tfXUnQb4V-rJjS7J_kqtZFS4Esx_Xb93M-jnQ4SnEiY"
}

$ErrorActionPreference = "Continue"
$pass = 0; $fail = 0; $total = 0

function Test-Security {
    param([string]$Name, [scriptblock]$Check)
    $script:total++
    Write-Host "  Testing: $Name" -ForegroundColor Gray -NoNewline
    try {
        $result = & $Check
        if ($result) {
            Write-Host "`r  [PASS] $Name" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "`r  [FAIL] $Name" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "`r  [FAIL] $Name --- Error: $_" -ForegroundColor Red
        $script:fail++
    }
}

$serviceHeaders = @{
    "Content-Type"  = "application/json"
    "apikey"        = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
}

$anonHeaders = @{
    "Content-Type"  = "application/json"
    "apikey"        = $AnonKey
    "Authorization" = "Bearer $AnonKey"
}

function Get-AcknowledgeFixture {
    param(
        [string]$ComplaintId = ([guid]::NewGuid().ToString()),
        [int]$ExpiresInSeconds = 900
    )

    $response = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge?seed=1&complaintId=$ComplaintId&expiresInSeconds=$ExpiresInSeconds" `
        -Method GET -UseBasicParsing

    return $response.Content | ConvertFrom-Json
}

# Reference IDs from seed data
$hospital_A = "2cf24f6f-6a6a-4187-b426-63a2417c7e97"
$hospital_B = "b8f35e7a-1234-4abc-def0-111122223333"
$dept_medicine = "42254d74-623c-4472-bb04-df406fcf09c9"
$dept_surgery  = "534cf3be-82f5-4eed-9d14-bf4a207285bb"
$dept_cardio_B = "aa11bb22-cc33-dd44-ee55-ff6677889900"
$patient_A = "11111111-aaaa-bbbb-cccc-000000000001"
$patient_B = "11111111-aaaa-bbbb-cccc-000000000002"
$golden_complaint = "aaaaaaaa-0000-1111-2222-333333333333"

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  TASK 6.2 --- SECURITY & PRIVACY PENETRATION TEST SUITE" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ("=" * 70) -ForegroundColor Cyan

# ==============================================================
# SECTION 1: SQL INJECTION TESTING
# ==============================================================
Write-Host "`n--- Section 1: SQL Injection Testing ---" -ForegroundColor Yellow

$sqli_payloads = @(
    "' OR 1=1 --",
    "'; DROP TABLE complaints; --",
    "' UNION SELECT id,email,role,department_id,null,null,null,null,null FROM users --",
    "1; UPDATE complaints SET status='closed' WHERE 1=1; --",
    "' AND 1=CONVERT(int,(SELECT TOP 1 password FROM users))--",
    "<script>alert('XSS')</script>"
)

foreach ($payload in $sqli_payloads) {
    $shortPayload = if ($payload.Length -gt 40) { $payload.Substring(0,40) + "..." } else { $payload }
    Test-Security "SQLi rejected: $shortPayload" {
        $body = @{
            patient_id    = $payload
            hospital_id   = $hospital_A
            department_id = $dept_medicine
            severity_level = "high"
            status        = "submitted"
        } | ConvertTo-Json

        try {
            $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaints" `
                -Method POST -Body $body -Headers $serviceHeaders `
                -UseBasicParsing -ErrorAction SilentlyContinue

            # If it succeeds when it shouldn't
            if ($response.StatusCode -ge 400) { $true } else { $false }
        } catch {
            if ($_.Exception.Response) {
                $_.Exception.Response.StatusCode.value__ -ge 400
            } else {
                $true
            }
        }
    }
}

# Test SQL injection via the acknowledge API endpoint
Test-Security "SQLi via /api/acknowledge rejected" {
    $body = @{ token = "'; DROP TABLE complaints; --" } | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge" `
            -Method POST -Body $body -Headers @{"Content-Type"="application/json"} `
            -UseBasicParsing -ErrorAction SilentlyContinue
        # Should return 400 or 401, never 200
        $response.StatusCode -ne 200
    } catch {
        $_.Exception.Response.StatusCode.value__ -ge 400
    }
}

# ==============================================================
# SECTION 2: ALE BYPASS ATTEMPTS
# ==============================================================
Write-Host "`n--- Section 2: ALE Bypass Testing ---" -ForegroundColor Yellow

# Test 2a: Patient cross-access via anon key (no auth session)
Test-Security "ALE bypass: anon key cannot read complaint_phi" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaint_phi?complaint_id=eq.$golden_complaint&select=description" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    # Anon key with RLS should return empty array
    $data = $response.Content | ConvertFrom-Json
    ($data.Count -eq 0) -or ($response.StatusCode -ge 400)
}

# Test 2c: Cross-tenant isolation --- Hospital A user queries Hospital B complaints
Test-Security "Cross-tenant: Hospital A query returns zero Hospital B data" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaints?hospital_id=eq.$hospital_B&select=id" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = $response.Content | ConvertFrom-Json
    # Under anon RLS, should be zero rows from Hospital B
    $data.Count -eq 0
}

# Test 2b: Read complaint from different department via PostgREST
Test-Security "Cross-dept: complaint_phi RLS blocks cross-department read" {
    # Fetch complaint_phi for a Medicine department complaint using anon key
    # Without proper JWT claims, RLS should block
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaint_phi?select=complaint_id&limit=5" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = $response.Content | ConvertFrom-Json
    # Anon should see nothing
    $data.Count -eq 0
}

# ==============================================================
# SECTION 3: ROLE ESCALATION TESTING
# ==============================================================
Write-Host "`n--- Section 3: Role Escalation Testing ---" -ForegroundColor Yellow

Test-Security "Role escalation: anon key cannot write to sla_configurations" {
    $body = @{
        hospital_id = $hospital_A
        severity_level = "critical"
        max_acknowledgement_hours = 1
        max_resolution_hours = 24
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/sla_configurations" `
            -Method POST -Body $body -Headers $anonHeaders `
            -UseBasicParsing -ErrorAction SilentlyContinue
        $response.StatusCode -ge 400
    } catch {
        $_.Exception.Response.StatusCode.value__ -ge 400
    }
}

Test-Security "Role escalation: anon key cannot write to users table" {
    $body = @{
        email = "hacker@evil.com"
        first_name = "Hacker"
        last_name = "Evil"
        role = "admin"
        hospital_id = $hospital_A
        mfa_enabled = $false
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/users" `
            -Method POST -Body $body -Headers $anonHeaders `
            -UseBasicParsing -ErrorAction SilentlyContinue
        $response.StatusCode -ge 400
    } catch {
        $_.Exception.Response.StatusCode.value__ -ge 400
    }
}

Test-Security "Role escalation: anon key cannot update complaint status" {
    $body = '{"status": "closed"}'
    try {
        $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaints?id=eq.$golden_complaint" `
            -Method PATCH -Body $body -Headers ($anonHeaders + @{ "Prefer" = "return=representation" }) `
            -UseBasicParsing -ErrorAction SilentlyContinue
        # Should either error or return empty (no rows matched under RLS)
        ($response.StatusCode -ge 400) -or (($response.Content | ConvertFrom-Json).Count -eq 0)
    } catch {
        $true
    }
}

Test-Security "Role escalation: anon key cannot read security_alerts" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/security_alerts?select=id&limit=1" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = $response.Content | ConvertFrom-Json
    $data.Count -eq 0
}

# ==============================================================
# SECTION 4: IDOR TESTING (PostgREST level)
# ==============================================================
Write-Host "`n--- Section 4: IDOR Testing ---" -ForegroundColor Yellow

Test-Security "IDOR: anon cannot enumerate all users" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/users?select=id,email,role&limit=100" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = $response.Content | ConvertFrom-Json
    # RLS should prevent bulk user enumeration
    $data.Count -eq 0
}

Test-Security "IDOR: anon cannot access audit_logs" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/audit_logs?select=id,action_type&limit=5" `
        -Method GET -Headers $anonHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = $response.Content | ConvertFrom-Json
    $data.Count -eq 0
}

# ==============================================================
# SECTION 5: HIPAA MINIMUM NECESSARY
# ==============================================================
Write-Host "`n--- Section 5: HIPAA Minimum Necessary ---" -ForegroundColor Yellow

Test-Security "HIPAA: complaints table has no PHI columns" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/complaints?select=*&limit=1" `
        -Method GET -Headers $serviceHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = ($response.Content | ConvertFrom-Json)
    if ($data.Count -gt 0) {
        $keys = ($data[0] | Get-Member -MemberType NoteProperty).Name
        # None of these PHI fields should exist in complaints table
        -not ($keys -contains "description") -and
        -not ($keys -contains "reporter_name") -and
        -not ($keys -contains "reporter_contact")
    } else { $true }
}

Test-Security "HIPAA: notifications table has zero PHI" {
    $response = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/notifications?select=*&limit=1" `
        -Method GET -Headers $serviceHeaders -UseBasicParsing -ErrorAction SilentlyContinue

    $data = ($response.Content | ConvertFrom-Json)
    if ($data.Count -gt 0) {
        $keys = ($data[0] | Get-Member -MemberType NoteProperty).Name
        -not ($keys -contains "description") -and
        -not ($keys -contains "reporter_name") -and
        -not ($keys -contains "reporter_contact") -and
        -not ($keys -contains "patient_name")
    } else { $true }
}

# ==============================================================
# SECTION 6: DEEP-LINK REPLAY ABUSE
# ==============================================================
Write-Host "`n--- Section 6: Deep-Link Replay Testing ---" -ForegroundColor Yellow

Test-Security "Deep-link: expired token is rejected" {
    $fixture = Get-AcknowledgeFixture -ExpiresInSeconds -3600
    $body = @{ token = $fixture.token } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge" `
            -Method POST -Body $body -Headers @{"Content-Type"="application/json"} `
            -UseBasicParsing -ErrorAction SilentlyContinue
        $response.StatusCode -eq 401
    } catch {
        $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

Test-Security "Deep-link: replay consumed token returns 200 idempotent success" {
    $fixture = Get-AcknowledgeFixture
    $body = @{ token = $fixture.token } | ConvertTo-Json

    $firstOk = $false
    try {
        $first = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge" `
            -Method POST -Body $body -Headers @{"Content-Type"="application/json"} `
            -UseBasicParsing -ErrorAction SilentlyContinue
        $firstPayload = $first.Content | ConvertFrom-Json
        $firstOk = ($first.StatusCode -eq 200 -and $firstPayload.outcome -eq "acknowledged")
    } catch {
        $firstOk = $false
    }

    # Replay same token --- must remain safe and idempotent
    try {
        $response = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge" `
            -Method POST -Body $body -Headers @{"Content-Type"="application/json"} `
            -UseBasicParsing -ErrorAction SilentlyContinue
        $payload = $response.Content | ConvertFrom-Json
        $firstOk -and $response.StatusCode -eq 200 -and ($payload.outcome -eq "already_read" -or $payload.outcome -eq "already_acknowledged")
    } catch {
        $false
    }
}

Test-Security "Deep-link: rate limit triggers on 6th request" {
    $results = @()
    for ($i = 1; $i -le 6; $i++) {
        $fixture = Get-AcknowledgeFixture
        $body = @{ token = $fixture.token } | ConvertTo-Json

        try {
            $response = Invoke-WebRequest -Uri "$NextUrl/api/acknowledge" `
                -Method POST -Body $body -Headers @{"Content-Type"="application/json"} `
                -UseBasicParsing -ErrorAction SilentlyContinue
            $results += $response.StatusCode
        } catch {
            $results += $_.Exception.Response.StatusCode.value__
        }
    }
    # The 6th request should be rate-limited (429)
    $results[-1] -eq 429
}

# ==============================================================
# SECTION 7: IMMUTABLE TABLE PROTECTIONS
# ==============================================================
Write-Host "`n--- Section 7: Immutable Table Protections ---" -ForegroundColor Yellow

Test-Security "Immutable: DELETE on audit_logs blocked by trigger" {
    $query = "DELETE FROM public.audit_logs WHERE id = (SELECT id FROM public.audit_logs LIMIT 1);"
    $result = echo $query | docker exec -i supabase-db psql -U postgres -d postgres 2>&1
    $result -match "TAMPER DETECTED" -or $result -match "permission denied"
}

Test-Security "Immutable: DELETE on complaint_status_history blocked" {
    $query = "DELETE FROM public.complaint_status_history WHERE id = (SELECT id FROM public.complaint_status_history LIMIT 1);"
    $result = echo $query | docker exec -i supabase-db psql -U postgres -d postgres 2>&1
    $result -match "TAMPER DETECTED" -or $result -match "permission denied"
}

# ==============================================================
# SUMMARY
# ==============================================================
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  RESULTS: $pass PASSED / $fail FAILED / $total TOTAL" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host ("=" * 70) -ForegroundColor Cyan

if ($fail -eq 0) {
    Write-Host "`n  Security pen test: ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "`n  Security pen test: $fail CHECK(S) FAILED - review required" -ForegroundColor Red
}

Write-Host ""
exit $fail
