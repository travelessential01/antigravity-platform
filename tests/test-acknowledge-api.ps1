<#
.SYNOPSIS
    Task 4.3 — Automated Test Suite for /api/acknowledge endpoint

.DESCRIPTION
    Runs 4 test scenarios against the running Next.js dev server:
      T1 — Valid token → 200 (complaint acknowledged, SLA cancelled)
      T2 — Replay protection → 200 (same token returns idempotent success)
      T3 — Expired token → 401 (signed token with past expiry)
      T4 — Rate limit → 429 (6 requests in rapid succession)

    Requires: pnpm run dev running on http://localhost:3000
              Redis container running (Authentik Docker stack)

.USAGE
    .\tests\test-acknowledge-api.ps1

.NOTES
    This script uses the dev-only GET /api/acknowledge endpoint to generate
    stub tokens. This endpoint is DISABLED in production.
#>

param(
    [string]$BaseUrl = "http://localhost:3000",
    [int]$TimeoutSec = 10
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
$pass = 0
$fail = 0
$results = @()

function Invoke-Test {
    param(
        [string]$Name,
        [scriptblock]$Block,
        [int]$ExpectedStatus,
        [string]$ExpectedBodyContains = ""
    )

    Write-Host "`n  ► $Name" -ForegroundColor Cyan
    try {
        $result = & $Block
        $status  = $result.Status
        $body    = $result.Body | ConvertTo-Json -Compress -ErrorAction SilentlyContinue

        $statusOk = ($status -eq $ExpectedStatus)
        $bodyOk   = ($ExpectedBodyContains -eq "" -or $body -match $ExpectedBodyContains)

        if ($statusOk -and $bodyOk) {
            Write-Host "    ✅ PASS  HTTP $status" -ForegroundColor Green
            if ($result.Body) { Write-Host "    ↳ $body" -ForegroundColor DarkGray }
            $script:pass++
            return @{ Pass = $true; Status = $status; Body = $result.Body }
        } else {
            $reason = if (-not $statusOk) { "Expected HTTP $ExpectedStatus, got $status" } else { "Body mismatch: expected '$ExpectedBodyContains'" }
            Write-Host "    ❌ FAIL  $reason" -ForegroundColor Red
            if ($result.Body) { Write-Host "    ↳ $body" -ForegroundColor DarkGray }
            $script:fail++
            return @{ Pass = $false; Status = $status; Body = $result.Body }
        }
    } catch {
        Write-Host "    ❌ ERROR  $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        return @{ Pass = $false; Status = 0; Body = $null }
    }
}

function Invoke-Endpoint {
    param([string]$Method, [string]$Path, [hashtable]$Body = $null)

    $uri = "$BaseUrl$Path"
    $params = @{
        Uri         = $uri
        Method      = $Method
        TimeoutSec  = $TimeoutSec
        ErrorAction = "SilentlyContinue"
    }
    if ($Body) {
        $params.ContentType = "application/json"
        $params.Body        = ($Body | ConvertTo-Json -Compress)
    }

    try {
        $resp = Invoke-WebRequest @params
        return @{ Status = [int]$resp.StatusCode; Body = $resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue }
    } catch [System.Net.WebException] {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $stream  = $_.Exception.Response.GetResponseStream()
        $reader  = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd() | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ Status = $statusCode; Body = $content }
    }
}

function Get-SeededAcknowledgeFixture {
    param(
        [string]$ComplaintId,
        [int]$ExpiresInSeconds = 900
    )

    $resp = Invoke-Endpoint -Method GET -Path "/api/acknowledge?seed=1&complaintId=$ComplaintId&expiresInSeconds=$ExpiresInSeconds"
    if ($resp.Status -ne 200 -or -not $resp.Body.token) {
        throw "Failed to get seeded fixture from GET /api/acknowledge (HTTP $($resp.Status))"
    }
    return $resp.Body
}

# ---------------------------------------------------------------------------
# Pre-flight check
# ---------------------------------------------------------------------------
Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "║   Task 4.3 — Acknowledge API Automated Test Suite   ║" -ForegroundColor DarkCyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host "  Target: $BaseUrl" -ForegroundColor DarkGray

Write-Host "`n[Pre-flight] Checking dev server..." -ForegroundColor Yellow
$ping = Invoke-Endpoint -Method GET -Path "/"
if ($ping.Status -eq 0) {
    Write-Host "  ✗ Dev server not reachable at $BaseUrl" -ForegroundColor Red
    Write-Host "  Run: pnpm run dev (in a separate terminal)" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Dev server reachable (HTTP $($ping.Status))" -ForegroundColor Green

Write-Host "`n[Pre-flight] Checking stub token endpoint..." -ForegroundColor Yellow
$stubCheck = Invoke-Endpoint -Method GET -Path "/api/acknowledge"
if ($stubCheck.Status -ne 200) {
    Write-Host "  ✗ GET /api/acknowledge returned HTTP $($stubCheck.Status)" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Stub token endpoint available" -ForegroundColor Green

# ---------------------------------------------------------------------------
# T1 — Valid acknowledge (expect 200)
# ---------------------------------------------------------------------------
Write-Host "`n━━━ T1: Valid Token → 200 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan

$complaintIdT1 = [System.Guid]::NewGuid().ToString()
$tokenT1       = $null

Invoke-Test -Name "GET seeded token for T1" -ExpectedStatus 200 -Block {
    $resp = Invoke-Endpoint -Method GET -Path "/api/acknowledge?seed=1&complaintId=$complaintIdT1"
    $script:tokenT1 = $resp.Body.token
    $resp
}

if ($tokenT1) {
    Invoke-Test -Name "POST acknowledge with valid token → 200" `
        -ExpectedStatus 200 `
        -ExpectedBodyContains "success" `
        -Block { Invoke-Endpoint -Method POST -Path "/api/acknowledge" -Body @{ token = $tokenT1 } }
}

# ---------------------------------------------------------------------------
# T2 — Replay protection (expect 200 idempotent success)
# ---------------------------------------------------------------------------
Write-Host "`n━━━ T2: Replay Protection → 200 ━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan

if ($tokenT1) {
    Invoke-Test -Name "Re-submit same token → 200 idempotent success" `
        -ExpectedStatus 200 `
        -ExpectedBodyContains "already_" `
        -Block { Invoke-Endpoint -Method POST -Path "/api/acknowledge" -Body @{ token = $tokenT1 } }
}

# ---------------------------------------------------------------------------
# T3 — Expired token (expect 401)
# ---------------------------------------------------------------------------
Write-Host "`n━━━ T3: Expired Token → 401 ━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan

$expiredComplaintId = [System.Guid]::NewGuid().ToString()
$expiredFixture = Get-SeededAcknowledgeFixture -ComplaintId $expiredComplaintId -ExpiresInSeconds -3600

Invoke-Test -Name "POST expired token → 401" `
    -ExpectedStatus 401 `
    -ExpectedBodyContains "expired" `
    -Block { Invoke-Endpoint -Method POST -Path "/api/acknowledge" -Body @{ token = $expiredFixture.token } }

# ---------------------------------------------------------------------------
# T4 — Rate limiting (expect 429 on 6th request)
# ---------------------------------------------------------------------------
Write-Host "`n━━━ T4: Rate Limiting → 429 on 6th Request ━━━━━━━━━━━" -ForegroundColor DarkCyan
Write-Host "  Sending 6 rapid requests (limit: 5/min)..." -ForegroundColor DarkGray

$statusCodes = @()
for ($i = 1; $i -le 6; $i++) {
    $loopComplaintId = [System.Guid]::NewGuid().ToString()
    $loopToken = (Get-SeededAcknowledgeFixture -ComplaintId $loopComplaintId).token
    $r = Invoke-Endpoint -Method POST -Path "/api/acknowledge" -Body @{ token = $loopToken }
    $statusCodes += $r.Status
    Write-Host "  Request $i → HTTP $($r.Status)" -ForegroundColor DarkGray
}

$first5Ok    = ($statusCodes[0..4] | Where-Object { $_ -eq 200 }).Count -eq 5
$sixthIs429  = ($statusCodes[5] -eq 429)

Invoke-Test -Name "First 5 requests succeed (200)" -ExpectedStatus 200 -Block {
    if ($first5Ok) { @{ Status = 200; Body = @{ note = "All 5 non-rate-limited" } } }
    else           { @{ Status = 500; Body = @{ note = "One of first 5 was unexpected: $($statusCodes[0..4] -join ',')" } } }
}

Invoke-Test -Name "6th request is rate-limited → 429" -ExpectedStatus 429 -Block {
    @{ Status = $statusCodes[5]; Body = @{ rate_limited = ($statusCodes[5] -eq 429) } }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
$total = $pass + $fail
$color = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host ("║   Results: {0}/{1} passed  {2}" -f $pass, $total, (" " * [Math]::Max(0, 40 - "$pass/$total".Length))) -ForegroundColor $color
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan

if ($fail -gt 0) {
    Write-Host "`nSome tests failed. Check that:" -ForegroundColor Yellow
    Write-Host "  1. pnpm run dev is running on $BaseUrl" -ForegroundColor DarkGray
    Write-Host "  2. Redis is running (Docker Authentik stack)" -ForegroundColor DarkGray
    Write-Host "  3. Supabase self-hosted is running (for processed_events table)" -ForegroundColor DarkGray
    exit 1
} else {
    Write-Host "`n  All tests passed ✅" -ForegroundColor Green
    exit 0
}
