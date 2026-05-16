<#
.SYNOPSIS
Compatibility wrapper for the isolated TypeScript DR simulation suite.

.USAGE
$env:ALLOW_DESTRUCTIVE_TESTS = "true"
$env:TEST_ENVIRONMENT = "isolated"
.\tests\dr\dr_simulation.ps1
#>

pnpm exec vitest run tests/destructive/dr-simulation.test.ts
exit $LASTEXITCODE
