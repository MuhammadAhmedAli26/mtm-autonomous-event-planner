# Test serve.mjs: Start background process, curl GET /, curl POST /api/message, Stop-Process
Set-Location 'C:\mtm-agent'

Write-Host "Starting serve.mjs in background..."
$proc = Start-Process node -ArgumentList 'serve.mjs' -PassThru -NoNewWindow
Start-Sleep -Seconds 2

try {
    Write-Host "`n=== 1. TESTING GET / (CURL / INVOKE-WEBREQUEST) ==="
    $page = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing
    Write-Host "HTTP Status: $($page.StatusCode)"
    Write-Host "Page Title : $(($page.Content | Select-String '<title>(.*?)</title>').Matches.Groups[1].Value)"
    Write-Host "Content-Length: $($page.RawContentLength) bytes"

    Write-Host "`n=== 2. TESTING POST /api/message ==="
    $testPayload = @{ text = "Finance here. The printing bill came in at Rs 15,000, not Rs 10,000." } | ConvertTo-Json
    $postResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/message' -Method Post -ContentType 'application/json' -Body $testPayload
    Write-Host "POST Success : $($postResponse.success)"
    Write-Host "Plan Status  : $($postResponse.plan.status)"
    Write-Host "Budget Total : Rs $($postResponse.plan.budget.totalCost)"
    Write-Host "Messages Count: $($postResponse.messages.Count)"
}
finally {
    Write-Host "`nStopping server process (PID: $($proc.Id))..."
    Stop-Process -Id $proc.Id -Force
    Write-Host "Server process terminated cleanly."
}
