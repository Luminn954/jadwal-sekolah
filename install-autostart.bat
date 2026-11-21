@echo off
set "ROOT=%~dp0"
echo Memasang autostart Jadwal Kelas...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\install-startup.ps1"
if errorlevel 1 (
    echo Gagal memasang autostart. Cek pesan error di atas.
) else (
    echo Autostart Jadwal Kelas berhasil dipasang.
)
pause
