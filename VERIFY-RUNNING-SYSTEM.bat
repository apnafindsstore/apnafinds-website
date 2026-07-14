@echo off
title Verify ApnaFinds Automatic Process
cd /d "%~dp0"
node scripts\verify-running-system.js
echo.
pause
