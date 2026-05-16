<#
.SYNOPSIS
Compatibility wrapper for the TypeScript acknowledge integration suite.

.USAGE
.\tests\test-acknowledge-api.ps1
#>

param(
    [string]$BaseUrl = $env:TEST_APP_URL
)

if ($BaseUrl) {
    $env:TEST_APP_URL = $BaseUrl
}

pnpm exec vitest run tests/integration/acknowledge.test.ts
exit $LASTEXITCODE
