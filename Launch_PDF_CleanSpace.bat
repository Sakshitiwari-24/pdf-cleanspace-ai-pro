@echo off
title PDF CleanSpace AI Pro Launcher
echo ============================================================
echo   ⚡ Starting PDF CleanSpace AI Pro Desktop Launcher...
echo ============================================================
echo.

cd /d "%~dp0"

start "" node server.js

echo App launching at http://localhost:8000/ ...
exit
