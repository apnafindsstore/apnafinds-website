@echo off
title Create ApnaFinds Automatic Demo Order
cd /d "%~dp0"
node scripts\create-demo-order.js
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "http://localhost:3000/track-order.html"
echo.
echo The demo tracking status advances automatically.
echo You can also press Refresh Tracking to advance one demo stage.
echo.
pause
