@echo off
:: PDF CleanSpace AI Pro - Automatic Desktop Shortcut Creator
title PDF CleanSpace Desktop Installer

echo Creating PDF CleanSpace AI Pro Desktop Shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [System.Environment]::GetFolderPath('Desktop'); $sc = $ws.CreateShortcut((Join-Path $desktop 'PDF CleanSpace AI Pro.lnk')); $sc.TargetPath = '%~dp0Launch_PDF_CleanSpace.bat'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'PDF CleanSpace AI Pro Launcher'; $sc.Save()"

echo ============================================================
echo  ✅ SUCCESS! PDF CleanSpace AI Pro icon installed to Desktop!
echo ============================================================
echo.
echo Check your Desktop screen for 'PDF CleanSpace AI Pro'.
echo.
pause
