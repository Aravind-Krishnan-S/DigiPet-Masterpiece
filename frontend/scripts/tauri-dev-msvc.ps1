param(
    [string]$VsInstallPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"

$vsDevCmd = Join-Path $VsInstallPath "Common7\Tools\VsDevCmd.bat"
if (-not (Test-Path $vsDevCmd)) {
    throw "VsDevCmd.bat not found at '$vsDevCmd'. Update -VsInstallPath to your Visual Studio Build Tools installation."
}

$envDump = & cmd.exe /s /c "`"$vsDevCmd`" -arch=x64 -host_arch=x64 >nul && set"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to import the Visual Studio Build Tools environment from '$vsDevCmd'."
}

foreach ($line in $envDump) {
    if ($line -match '^(.*?)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

Write-Host "Using MSVC from $VsInstallPath"
Write-Host "Launching: npx tauri dev $($TauriArgs -join ' ')"

& npx tauri dev @TauriArgs
exit $LASTEXITCODE
