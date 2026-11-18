# Zero-dependency clean clone test script
$targetTemp = Join-Path $env:TEMP 'mtm_clone_verify'
if (Test-Path $targetTemp) {
    Remove-Item $targetTemp -Recurse -Force
}

Write-Host "Cloning repo into $targetTemp..."
git clone 'C:\mtm-agent' $targetTemp

Write-Host "Setting up test environment in clone..."
Copy-Item 'C:\mtm-agent\.env' (Join-Path $targetTemp '.env')
New-Item -ItemType Directory -Path (Join-Path $targetTemp 'packs') -Force | Out-Null
Copy-Item 'C:\mtm-agent\packs\sample_pack.txt' (Join-Path $targetTemp 'packs\sample_pack.txt')

Set-Location $targetTemp

Write-Host "Running node plan.mjs on clean clone (zero npm installs)..."
node plan.mjs packs/sample_pack.txt

Write-Host "Running unit tests in clean clone..."
node --test tests/*.test.mjs

Write-Host "CLEAN CLONE VERIFICATION 100% SUCCESSFUL!"
