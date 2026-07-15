@echo off
setlocal
title ApnaFinds Full Automatic Store
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Install Node.js 18 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created .env from .env.example
)

if not exist "node_modules" (
  echo Installing required packages...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo ========================================================
echo  APNAFINDS FULL AUTOMATIC WEBSITE
echo ========================================================
echo  Store:              http://localhost:3000
echo  Customer tracking:  http://localhost:3000/track-order.html
echo  Admin login:         http://localhost:3000/admin-login.html
echo  Admin dashboard:     http://localhost:3000/admin.html
echo  Admin management:    http://localhost:3000/admin-management.html
echo  Admin logistics:     http://localhost:3000/admin-logistics.html
echo  Seller account:      http://localhost:3000/admin-seller.html
echo  Payments:            http://localhost:3000/admin-payments.html
echo  Customer details:    http://localhost:3000/admin-customers.html
echo.
echo  First local admin login:
echo  Email:    admin@apnafinds.local
echo  Password: ApnaFinds@123
echo.
echo  Change ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET
echo  and ADMIN_API_TOKEN in .env before public hosting.
echo ========================================================
echo.
echo IMPORTANT: Keep this window open while using the website.
echo Do not open HTML files with file:/// or VS Code Live Server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/admin-login.html"
call npm start
pause
