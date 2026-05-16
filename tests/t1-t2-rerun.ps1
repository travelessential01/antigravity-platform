<#
.SYNOPSIS
Compatibility wrapper for the TypeScript acknowledge integration suite.

.USAGE
.\tests\t1-t2-rerun.ps1
#>

pnpm exec vitest run tests/integration/acknowledge.test.ts
exit $LASTEXITCODE
