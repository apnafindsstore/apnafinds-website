@echo off
setlocal
title Reset ApnaFinds Local Login
cd /d "%~dp0"
echo.
echo This will reset ONLY the local .env configuration to the supplied demo defaults.
echo Any Shiprocket or OpenAI keys currently saved in .env will be removed.
echo.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 0
if exist ".env" copy ".env" ".env.backup" >nul
copy /Y ".env.example" ".env" >nul
echo.
echo Local login reset successfully.
echo Email: admin@apnafinds.local
echo Password: ApnaFinds@123
echo.
echo Close any running Node server and start START-APNAFINDS.bat again.
pause
