<#
.SYNOPSIS
Compatibility wrapper for the TypeScript security suite.

.USAGE
.\tests\security\pen_test_suite.ps1
#>

pnpm exec vitest run tests/security
exit $LASTEXITCODE
