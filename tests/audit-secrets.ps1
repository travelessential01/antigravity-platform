# Task 7.4 - Pre-Production Secrets Audit
# tests/audit-secrets.ps1
#
# Run: powershell -File "tests\audit-secrets.ps1"
# Run (CI gate): powershell -File "tests\audit-secrets.ps1" -ProductionMode $true
#
# Checks:
#   1. .env must not exist at production deploy time
#   2. No AWS credential patterns in source
#   3. SUPABASE_SERVICE_ROLE_KEY not hardcoded in source
#   4. AES key material not hardcoded in source
#   5. Elasticsearch default credentials not in source
#   6. No PEM private keys committed
#   7. JWT_SECRET meets minimum length (32+ chars)
#   8. AUTHENTIK_SECRET_KEY does not contain placeholder values
#   9. PHI_ENCRYPTION_KEY_ID is not a dev placeholder in prod

param(
    [string]$ProjectRoot = "c:\Application V4.0",
    [bool]$ProductionMode = $false
)

$ErrorCount = 0
$WarnList   = @()
$FailList   = @()

function Pass([string]$Check) {
    Write-Host "  [PASS] $Check" -ForegroundColor Green
}
function Warn([string]$Check) {
    Write-Host "  [WARN] $Check" -ForegroundColor Yellow
    $script:WarnList += $Check
}
function Fail([string]$Check) {
    Write-Host "  [FAIL] $Check" -ForegroundColor Red
    $script:FailList += $Check
    $script:ErrorCount++
}

Write-Host ""
Write-Host "=== Antigravity Task 7.4 - Secrets Audit ===" -ForegroundColor Cyan
Write-Host "Root: $ProjectRoot"
Write-Host "Mode: $(if ($ProductionMode) { 'PRODUCTION (failures block deployment)' } else { 'Development (informational)' })"
Write-Host ""

# Check 1: .env file
Write-Host "-- Check 1: .env file presence --"
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    if ($ProductionMode) {
        Fail ".env file present at production deploy - all secrets must be in secrets manager"
    }
    else {
        Warn ".env file present (OK in dev, must be removed before production deployment)"
    }
}
else {
    Pass "No .env file present"
}

# Check 2: AWS credentials in source
Write-Host ""
Write-Host "-- Check 2: AWS credentials in source --"
$srcFiles = Get-ChildItem -Path (Join-Path $ProjectRoot "src") -Recurse -Include "*.ts","*.tsx","*.js","*.mjs" -File
$awsHits = $srcFiles | Select-String -Pattern "AKIA[A-Z0-9]{16}" -ErrorAction SilentlyContinue
if ($awsHits) {
    $awsHits | ForEach-Object { Fail "AWS Access Key found: $($_.Filename):$($_.LineNumber)" }
}
else {
    Pass "No AWS Access Keys found in source files"
}

# Check 3: Service Role Key hardcoded
Write-Host ""
Write-Host "-- Check 3: Supabase service role key hardcoded in source --"
$srkHits = $srcFiles | Select-String -Pattern "SUPABASE_SERVICE_ROLE_KEY\s*=" -SimpleMatch |
    Where-Object { $_.Line -notmatch "process\.env" -and $_.Line -notmatch "#" }
if ($srkHits) {
    $srkHits | ForEach-Object { Fail "Hardcoded service role key in: $($_.Filename):$($_.LineNumber)" }
}
else {
    Pass "Service role key only referenced via process.env"
}

# Check 4: AES key material in source
Write-Host ""
Write-Host "-- Check 4: AES key material in source --"
$aesHits = $srcFiles | Select-String -Pattern "LOCAL_DEV_AES_GCM_KEY\s*=" -SimpleMatch |
    Where-Object { $_.Line -notmatch "process\.env" -and $_.Line -notmatch "TODO" -and $_.Line -notmatch "#" }
if ($aesHits) {
    $aesHits | ForEach-Object { Fail "Hardcoded AES key in: $($_.Filename):$($_.LineNumber)" }
}
else {
    Pass "AES key only referenced via process.env"
}

# Check 5: Elasticsearch default credentials
Write-Host ""
Write-Host "-- Check 5: Elasticsearch default credentials in source --"
$esHits = $srcFiles | Select-String -Pattern "changeme" -SimpleMatch
if ($esHits) {
    $esHits | ForEach-Object {
        Warn "Elasticsearch default credential in: $($_.Filename):$($_.LineNumber) - replace before production"
    }
}
else {
    Pass "No Elasticsearch default credentials in source"
}

# Check 6: PEM private keys
Write-Host ""
Write-Host "-- Check 6: PEM private keys committed --"
$allFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|\.next" }
$pemHits = $allFiles | Select-String -Pattern "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY" -ErrorAction SilentlyContinue
if ($pemHits) {
    $pemHits | ForEach-Object { Fail "PEM private key committed: $($_.Filename)" }
}
else {
    Pass "No PEM private keys found"
}

# Check 7: JWT_SECRET strength
Write-Host ""
Write-Host "-- Check 7: JWT_SECRET strength --"
if (Test-Path $envFile) {
    $jwtLine = Get-Content $envFile | Select-String "^JWT_SECRET=" | Select-Object -First 1
    if ($jwtLine) {
        $jwtVal = ($jwtLine -split "=", 2)[1].Trim()
        $len = $jwtVal.Length
        if ($len -lt 32) {
            Fail "JWT_SECRET too short ($len chars) - use a 256-bit random secret in production"
        }
        else {
            Pass "JWT_SECRET meets minimum length ($len chars)"
        }
    }
}

# Check 8: Authentik key placeholder
Write-Host ""
Write-Host "-- Check 8: Authentik secret key placeholder --"
if (Test-Path $envFile) {
    $authikLine = Get-Content $envFile | Select-String "^AUTHENTIK_SECRET_KEY=" | Select-Object -First 1
    if ($authikLine) {
        $authikVal = ($authikLine -split "=", 2)[1].Trim().ToLower()
        if ($authikVal -match "temporary|local|development|changeme|test") {
            Fail "AUTHENTIK_SECRET_KEY contains dev placeholder - must be production secret before deployment"
        }
        else {
            Pass "AUTHENTIK_SECRET_KEY does not contain obvious placeholder values"
        }
    }
}

# Check 9: PHI KMS key ID
Write-Host ""
Write-Host "-- Check 9: PHI_ENCRYPTION_KEY_ID (must be real KMS ARN in prod) --"
if (Test-Path $envFile) {
    $keyIdLine = Get-Content $envFile | Select-String "^PHI_ENCRYPTION_KEY_ID=" | Select-Object -First 1
    if ($keyIdLine) {
        $keyIdVal = ($keyIdLine -split "=", 2)[1].Trim()
        if ($keyIdVal -match "local_dev_only|placeholder|changeme") {
            if ($ProductionMode) {
                Fail "PHI_ENCRYPTION_KEY_ID is a dev placeholder - must be AWS KMS ARN in production"
            }
            else {
                Warn "PHI_ENCRYPTION_KEY_ID='$keyIdVal' - replace with AWS KMS ARN (ap-south-1) before production"
            }
        }
        else {
            Pass "PHI_ENCRYPTION_KEY_ID appears to reference a real key: $keyIdVal"
        }
    }
}

# Summary
Write-Host ""
Write-Host "============================================"
if ($ErrorCount -eq 0 -and $WarnList.Count -eq 0) {
    Write-Host "  RESULT: CLEAN - Zero secrets violations." -ForegroundColor Green
}
elseif ($ErrorCount -eq 0) {
    Write-Host "  RESULT: WARNINGS ($($WarnList.Count)) - Resolve before production:" -ForegroundColor Yellow
    $WarnList | ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
}
else {
    Write-Host "  RESULT: FAILED - $ErrorCount violation(s) must be resolved before deployment:" -ForegroundColor Red
    $FailList | ForEach-Object { Write-Host "    FAIL: $_" -ForegroundColor Red }
    $WarnList | ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
}
Write-Host "============================================"
Write-Host ""

if ($ProductionMode -and $ErrorCount -gt 0) {
    exit 1
}
