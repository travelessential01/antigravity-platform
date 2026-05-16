<#
.SYNOPSIS
Compatibility wrapper for the isolated TypeScript ledger tamper suite.

.USAGE
$env:ALLOW_DESTRUCTIVE_TESTS = "true"
$env:TEST_ENVIRONMENT = "isolated"
.\tests\security\ledger_tamper_test.ps1
#>

pnpm exec vitest run tests/destructive/ledger-tamper.test.ts
exit $LASTEXITCODE
