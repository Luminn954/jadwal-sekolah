$ErrorActionPreference = "Stop"

$launcher = Join-Path $PSScriptRoot "start-desktop.ps1"
$root = Split-Path -Parent $PSScriptRoot
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$taskName = "Jadwal Kelas Widget"
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launcher + '"'

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$trigger.Delay = "PT5S"
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Starts the local Jadwal Kelas server and desktop widget after Windows sign-in." `
  -Force | Out-Null

# Remove the old Run-key entry so Windows does not start the launcher twice.
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "JadwalKelas" -ErrorAction SilentlyContinue

$installedTask = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if ($installedTask.State -eq "Disabled") {
  Enable-ScheduledTask -TaskName $taskName | Out-Null
}
Write-Output "Autostart Jadwal Kelas aktif melalui Task Scheduler saat login Windows."
