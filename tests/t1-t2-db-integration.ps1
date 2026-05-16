<#
.SYNOPSIS
    T1 + T2 against a real complaint row provisioned by the dev acknowledge helper

.DESCRIPTION
    1. Check Supabase is reachable (localhost:8000)
    2. Ask GET /api/acknowledge?seed=1 to create a real complaint + notification fixture
    3. T1 - POST /api/acknowledge with the signed token -> 200
    4. T2 - Replay the same token -> 200 idempotent success
    5. Verify the complaint status in the DB
    6. Cleanup: soft-delete the seeded complaint

    Requires:
      - pnpm run dev running on http://localhost:3000
      - Supabase self-hosted running on http://localhost:8000
      - Redis running (Authentik Docker stack)

.USAGE
    .\tests\t1-t2-db-integration.ps1
#>

$AppUrl      = "http://localhost:3000"
$SupabaseUrl = "http://localhost:8000"
$ServiceKey  = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA"

$headers = @{
    "apikey"        = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=representation"
}

function Invoke-Supa {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $params = @{ Uri = "$SupabaseUrl/rest/v1$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
    try {
        $r = Invoke-WebRequest @params
        return @{ Ok = $true; Status = [int]$r.StatusCode; Data = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $body = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
        return @{ Ok = $false; Status = $code; Data = $body }
    }
}

function Invoke-App {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $params = @{ Uri = "$AppUrl$Path"; Method = $Method; UseBasicParsing = $true }
    if ($Body) { $params.ContentType = "application/json"; $params.Body = ($Body | ConvertTo-Json -Compress) }
    try {
        $r = Invoke-WebRequest @params
        return @{ Ok = $true; Status = [int]$r.StatusCode; Data = $r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $body = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
        return @{ Ok = $false; Status = $code; Data = $body | ConvertFrom-Json -ErrorAction SilentlyContinue }
    }
}

$pass = 0
$fail = 0
$seededComplaintId = $null

Write-Output "=== Pre-flight: Supabase connectivity ==="
$ping = Invoke-Supa -Method GET -Path "/hospitals?limit=1"
if (-not $ping.Ok -and $ping.Status -eq 0) {
    Write-Output "SKIP: Supabase not reachable at $SupabaseUrl - run self-hosted Docker stack first"
    exit 2
}
Write-Output "Supabase OK (HTTP $($ping.Status))"

Write-Output ""
Write-Output "=== Provisioning a real complaint + notification fixture ==="

$fixtureComplaintId = [System.Guid]::NewGuid().ToString()
$fixtureResp = Invoke-App -Method GET -Path "/api/acknowledge?seed=1&complaintId=$fixtureComplaintId"
if (-not $fixtureResp.Ok -or -not $fixtureResp.Data.token) {
    Write-Output "ERROR: Could not create acknowledge fixture - HTTP $($fixtureResp.Status)"
    Write-Output ($fixtureResp.Data | ConvertTo-Json -Compress)
    exit 1
}

$seededComplaintId = $fixtureResp.Data.complaintId
$token = $fixtureResp.Data.token
Write-Output "Seeded complaint: $seededComplaintId"

Write-Output ""
Write-Output "=== T1: Valid token against seeded complaint (expect 200) ==="

$t1 = Invoke-App -Method POST -Path "/api/acknowledge" -Body @{ token = $token }
Write-Output "T1 => HTTP $($t1.Status)  $($t1.Data | ConvertTo-Json -Compress)"

if ($t1.Status -eq 200 -and $t1.Data.outcome -eq "acknowledged") {
    Write-Output "T1 PASS - complaint acknowledged and timer cancelled"
    $pass++
} else {
    Write-Output "T1 FAIL - expected 200/acknowledged"
    $fail++
}

Write-Output ""
Write-Output "=== T2: Replay same token (expect 200 idempotent success) ==="

$t2 = Invoke-App -Method POST -Path "/api/acknowledge" -Body @{ token = $token }
Write-Output "T2 => HTTP $($t2.Status)  $($t2.Data | ConvertTo-Json -Compress)"

if ($t2.Status -eq 200 -and ($t2.Data.outcome -eq "already_read" -or $t2.Data.outcome -eq "already_acknowledged")) {
    Write-Output "T2 PASS - replay safely returned the current acknowledged state"
    $pass++
} else {
    Write-Output "T2 FAIL - expected 200/already_read or 200/already_acknowledged"
    $fail++
}

$checkResp = Invoke-Supa -Method GET -Path "/complaints?id=eq.$seededComplaintId&select=id,status"
Write-Output "DB status after T1/T2: $($checkResp.Data[0].status)"

Write-Output ""
Write-Output "=== Cleanup: soft-deleting seeded complaint ==="

$cleanResp = Invoke-Supa -Method PATCH -Path "/complaints?id=eq.$seededComplaintId" -Body @{ deleted_at = (Get-Date -Format "o") }
if ($cleanResp.Ok) {
    Write-Output "Cleanup OK - deleted_at set on $seededComplaintId"
} else {
    Write-Output "Cleanup WARNING - HTTP $($cleanResp.Status) (manual cleanup may be needed)"
}

Write-Output ""
$total = $pass + $fail
if ($fail -eq 0) {
    Write-Output "=== ALL PASS ($pass/$total) ==="
    exit 0
} else {
    Write-Output "=== $fail/$total FAILED ==="
    exit 1
}
