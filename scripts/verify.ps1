# SDKWork standards repository verification entrypoint
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node is required to run sdkwork-specs verification checks"
}

$checks = @(
    "tools/check-rpc-framework-standard.mjs",
    "tools/check-discovery-standard.mjs"
)

foreach ($check in $checks) {
    Write-Host "Running $check..."
    node $check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "sdkwork-specs verify: ok"
exit 0
