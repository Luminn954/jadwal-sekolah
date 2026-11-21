$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $root "node_modules\electron\dist\electron.exe"
$widgetMain = Join-Path $root "desktop-widget\main.cjs"

if (-not (Test-Path $electron)) {
    Write-Host "ERROR: Electron tidak ditemukan" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $widgetMain)) {
    Write-Host "ERROR: main.cjs tidak ditemukan" -ForegroundColor Red
    exit 1
}

Write-Host "Menutup widget Jadwal Kelas yang sedang berjalan..." -ForegroundColor Yellow
$widgetProcesses = Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($widgetMain, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
$mainWidgetProcesses = $widgetProcesses | Where-Object { $_.CommandLine -notmatch '(?:^|\s)--type=' }
foreach ($widgetProcess in $mainWidgetProcesses) {
    Stop-Process -Id $widgetProcess.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

Write-Host "Memulai ulang desktop widget..." -ForegroundColor Cyan
Start-Process -FilePath $electron -ArgumentList "`"$widgetMain`"" -WorkingDirectory $root -WindowStyle Hidden
Write-Host "Widget berhasil di-restart!" -ForegroundColor Green
