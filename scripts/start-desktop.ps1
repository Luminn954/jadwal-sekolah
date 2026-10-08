param(
  [int]$StartupDelaySeconds = 0
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $env:LOCALAPPDATA "JadwalKelas"
$logPath = Join-Path $logDirectory "startup.log"

function Write-StartupLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $logPath -Value "[$timestamp] $Message" -Encoding UTF8
}

try {
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  Write-StartupLog "Launcher started. Root: $root"

  if ($StartupDelaySeconds -gt 0) {
    Write-StartupLog "Waiting $StartupDelaySeconds seconds for Windows sign-in to finish."
    Start-Sleep -Seconds $StartupDelaySeconds
  }

  $distIndex = Join-Path $root "dist\index.html"
  $sourceFiles = Get-ChildItem -Path (Join-Path $root "src") -Recurse -File
  $latestSource = $sourceFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if (-not (Test-Path -LiteralPath $distIndex) -or $latestSource.LastWriteTimeUtc -gt (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc) {
    Write-StartupLog "Building the local app."
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    & $npm run build *>> $logPath
    if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE." }
    Write-StartupLog "Build completed."
  }

  $healthUrl = "http://127.0.0.1:4173/api/health"
  $serverReady = $false
  try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    $serverReady = $health.StatusCode -eq 200
  } catch {}

  if (-not $serverReady) {
    Write-StartupLog "Starting the local schedule server."
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $serverEntry = Join-Path $root "server\index.mjs"
    Start-Process -FilePath $node -ArgumentList ('"' + $serverEntry + '"') -WorkingDirectory $root -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
      Start-Sleep -Milliseconds 500
      try {
        $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200) {
          $serverReady = $true
          break
        }
      } catch {}
    }
  }

  if (-not $serverReady) { throw "Server lokal belum menyala di port 4173 setelah 30 detik." }
  Write-StartupLog "Local server is ready."

  $electron = Join-Path $root "node_modules\electron\dist\electron.exe"
  $widgetMain = Join-Path $root "desktop-widget\main.cjs"
  if (-not (Test-Path -LiteralPath $electron)) {
    Write-StartupLog "Electron runtime is missing; installing it."
    $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
    & $npx install-electron --no *>> $logPath
    if ($LASTEXITCODE -ne 0) { throw "Runtime Electron belum berhasil dipasang. Exit code $LASTEXITCODE." }
  }

  if (-not (Test-Path -LiteralPath $widgetMain)) { throw "File desktop widget tidak ditemukan: $widgetMain" }

  $widgetProcess = Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($widgetMain, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
    Select-Object -First 1
  if ($widgetProcess) {
    Write-StartupLog "Widget is already running (PID $($widgetProcess.ProcessId)); no duplicate launched."
  } else {
    Write-StartupLog "Launching the desktop widget."
    Start-Process -FilePath $electron -ArgumentList ('"' + $widgetMain + '"') -WorkingDirectory $root -WindowStyle Hidden
    Write-StartupLog "Widget launch requested."
  }
} catch {
  try {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Write-StartupLog "ERROR: $($_.Exception.Message)"
    if ($_.ScriptStackTrace) { Write-StartupLog "STACK: $($_.ScriptStackTrace)" }
  } catch {}
  exit 1
}
