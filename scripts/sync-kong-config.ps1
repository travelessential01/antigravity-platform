<#
.SYNOPSIS
    Syncs the Kong API Gateway declarative config from the repo template
    to the Docker volume path, then restarts Kong to apply changes.

.DESCRIPTION
    The Supabase Docker Compose setup mounts kong.yml from a host volume
    (C:\supabase-volumes\api\kong.yml) into the Kong container. The repo
    keeps its own template copy at supabase\docker\volumes\api\kong.yml.

    This script ensures both copies stay in sync by:
    1. Copying the repo template → Docker volume path
    2. Restarting the Kong container to reload the config

.EXAMPLE
    .\scripts\sync-kong-config.ps1
    .\scripts\sync-kong-config.ps1 -RestartKong $false   # copy only, no restart
#>

param(
    [bool]$RestartKong = $true
)

$ErrorActionPreference = "Stop"

# --- Paths ---
$RepoRoot    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RepoKong    = Join-Path $RepoRoot "supabase\docker\volumes\api\kong.yml"
$VolumeKong  = "C:\supabase-volumes\api\kong.yml"

# --- Validate source exists ---
if (-not (Test-Path $RepoKong)) {
    Write-Error "Source template not found: $RepoKong"
    exit 1
}

# --- Ensure destination directory exists ---
$VolumeDir = Split-Path -Parent $VolumeKong
if (-not (Test-Path $VolumeDir)) {
    Write-Host "[sync-kong] Creating volume directory: $VolumeDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $VolumeDir -Force | Out-Null
}

# --- Compare and copy ---
$needsCopy = $true
if (Test-Path $VolumeKong) {
    $srcHash = (Get-FileHash $RepoKong -Algorithm SHA256).Hash
    $dstHash = (Get-FileHash $VolumeKong -Algorithm SHA256).Hash
    if ($srcHash -eq $dstHash) {
        Write-Host "[sync-kong] Files already in sync. No copy needed." -ForegroundColor Green
        $needsCopy = $false
    } else {
        Write-Host "[sync-kong] Differences detected. Updating volume copy..." -ForegroundColor Yellow
        Write-Host "  Source:  $RepoKong" -ForegroundColor Gray
        Write-Host "  Target:  $VolumeKong" -ForegroundColor Gray
    }
}

if ($needsCopy) {
    Copy-Item -Path $RepoKong -Destination $VolumeKong -Force
    Write-Host "[sync-kong] Copied kong.yml to Docker volume path." -ForegroundColor Green
}

# --- Restart Kong ---
if ($RestartKong -and $needsCopy) {
    Write-Host "[sync-kong] Restarting Kong container..." -ForegroundColor Cyan
    docker restart supabase-kong 2>&1 | Out-Null
    Start-Sleep -Seconds 3

    $status = docker inspect supabase-kong --format "{{.State.Status}}" 2>&1
    if ($status -eq "running") {
        Write-Host "[sync-kong] Kong restarted successfully. Status: $status" -ForegroundColor Green
    } else {
        Write-Error "[sync-kong] Kong failed to restart. Status: $status"
        exit 1
    }
} elseif (-not $needsCopy) {
    Write-Host "[sync-kong] Skipping restart (no changes)." -ForegroundColor Gray
}

Write-Host "[sync-kong] Done." -ForegroundColor Green
