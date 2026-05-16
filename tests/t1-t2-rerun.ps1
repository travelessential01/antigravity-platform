# T1 + T2 quick rerun using the seeded dev acknowledge helper
# T1 - valid token against a real pending notification returns 200/acknowledged
# T2 - replay of the same token returns 200 idempotent success
$url = "http://localhost:3000"
$cid = [System.Guid]::NewGuid().ToString()

Write-Output "=== T1: Valid token against seeded fixture (expect 200) ==="
Write-Output "complaintId: $cid"

$getResp = Invoke-WebRequest -Uri "$url/api/acknowledge?seed=1&complaintId=$cid" -Method GET -UseBasicParsing
$fixture = $getResp.Content | ConvertFrom-Json
$token   = $fixture.token
Write-Output "Seeded fixture acquired OK."

try {
    $r1 = Invoke-WebRequest -Uri "$url/api/acknowledge" -Method POST -UseBasicParsing `
          -ContentType "application/json" -Body (@{ token = $token } | ConvertTo-Json)
    $t1Status = [int]$r1.StatusCode
    $t1Body = $r1.Content | ConvertFrom-Json
    Write-Output "T1 => HTTP $t1Status  $($r1.Content)"
} catch {
    $t1Status = [int]$_.Exception.Response.StatusCode
    $body = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
    $t1Body = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
    Write-Output "T1 => HTTP $t1Status  $body"
}

if ($t1Status -eq 200 -and $t1Body.outcome -eq "acknowledged") {
    Write-Output "T1 PASS - complaint acknowledged"
} else {
    Write-Output "T1 FAIL - expected 200/acknowledged"
}

Write-Output ""
Write-Output "=== T2: Replay same token (expect 200 idempotent success) ==="
try {
    $r2 = Invoke-WebRequest -Uri "$url/api/acknowledge" -Method POST -UseBasicParsing `
          -ContentType "application/json" -Body (@{ token = $token } | ConvertTo-Json)
    $t2Status = [int]$r2.StatusCode
    $t2Body = $r2.Content | ConvertFrom-Json
    Write-Output "T2 => HTTP $t2Status  $($r2.Content)"
} catch {
    $t2Status = [int]$_.Exception.Response.StatusCode
    $body2 = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
    $t2Body = $body2 | ConvertFrom-Json -ErrorAction SilentlyContinue
    Write-Output "T2 => HTTP $t2Status  $body2"
}

if ($t2Status -eq 200 -and ($t2Body.outcome -eq "already_read" -or $t2Body.outcome -eq "already_acknowledged")) {
    Write-Output "T2 PASS - replay safely returned idempotent success"
} else {
    Write-Output "T2 FAIL - expected 200/already_read or 200/already_acknowledged"
}

Write-Output ""
if (($t1Status -eq 200 -and $t1Body.outcome -eq "acknowledged") -and ($t2Status -eq 200 -and ($t2Body.outcome -eq "already_read" -or $t2Body.outcome -eq "already_acknowledged"))) {
    Write-Output "=== ALL PASS ==="
    exit 0
} else {
    Write-Output "=== SOME TESTS FAILED ==="
    exit 1
}
