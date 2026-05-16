Write-Host "====================================================="
Write-Host "  ANTIGRAVITY V4.1 - OBSERVABILITY DEMONSTRATION"
Write-Host "====================================================="
Write-Host ""
Write-Host "[1/2] Firing Sentry exception and SLA breach metric..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring-test"
    Write-Host "  -> Success: $($response.message)"
} catch {
    Write-Host "  -> Warning: Could not connect to API (is the dev server running?)"
}

Write-Host ""
Write-Host "[2/2] Simulating Inngest SLA Queue Overload (150+ events)..."
# Setting environment variables for the Node.js process to ensure it connects locally if needed
$env:INNGEST_EVENT_KEY = "local"
$env:INNGEST_SIGNING_KEY = "local"
node .\scripts\simulate_queue_load.mjs

Write-Host ""
Write-Host "====================================================="
Write-Host "✅ Injections Complete!"
Write-Host "  - Check Sentry Dashboard for unhandled Next.js error."
Write-Host "  - Check SigNoz Dashboards for: "
Write-Host "    * inngest.queue.depth spike > 100"
Write-Host "    * sla.breach.rate increment"
Write-Host "  - Await PagerDuty alert warning!"
Write-Host "====================================================="
