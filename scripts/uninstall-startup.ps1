$ErrorActionPreference = "Stop"
$taskName = "Jadwal Kelas Widget"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "JadwalKelas" -ErrorAction SilentlyContinue
Write-Output "Autostart Jadwal Kelas sudah dimatikan."
