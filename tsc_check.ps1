Set-Location 'C:\ai-smart-preview'
$output = npx tsc --noEmit 2>&1
$output | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -eq 0) {
    Write-Host "TSC_PASS"
} else {
    Write-Host "TSC_FAIL"
}
