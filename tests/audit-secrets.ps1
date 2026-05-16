<#
.SYNOPSIS
Compatibility wrapper for the TypeScript secrets hygiene suite.

.USAGE
.\tests\audit-secrets.ps1
.\tests\audit-secrets.ps1 -ProductionMode $true
#>

param(
    [bool]$ProductionMode = $false
)

if ($ProductionMode) {
    $env:TEST_PRODUCTION_MODE = "true"
}

pnpm exec vitest run tests/security/secrets.test.ts
exit $LASTEXITCODE
