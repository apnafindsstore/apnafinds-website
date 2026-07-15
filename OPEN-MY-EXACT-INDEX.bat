@echo off
setlocal
cd /d "%~dp0"
echo Opening YOUR exact ApnaFinds Index page...
start "" "http://localhost:3000/index.html?myExactIndex=1"
endlocal
