@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title QRCraft Launcher

set "PORT=3000"
set "URL=http://127.0.0.1:%PORT%"

echo.
echo   QRCraft - Medieval QR Worlds
echo   ==============================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Download the current LTS release from:
  echo   https://nodejs.org/en/download
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available. Reinstall Node.js from:
  echo   https://nodejs.org/en/download
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VERSION=%%v"
for /f "delims=" %%v in ('npm --version') do set "NPM_VERSION=%%v"
echo   Node.js : !NODE_VERSION!
echo   npm     : !NPM_VERSION!
echo.

if not exist "node_modules" (
  echo   Dependencies are missing. Installing...
  if exist "package-lock.json" (
    call npm ci --no-audit --no-fund
  ) else (
    call npm install --no-audit --no-fund
  )
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed. Review the output above.
    echo.
    pause
    exit /b 1
  )
  echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo [ERROR] Port %PORT% is already in use.
  echo Close the process using it, then run start.bat again.
  echo.
  pause
  exit /b 1
)

echo   Building the production app. This usually takes 20-60 seconds...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] The production build failed. Review the output above.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting the production server in a new window...
start "QRCraft Server" cmd /k ""%~dp0scripts\serve.bat""

echo   Waiting for QRCraft to respond with HTTP 200 at %URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-for-server.ps1" -Url "%URL%" -TimeoutSeconds 120
if errorlevel 1 (
  echo.
  echo [ERROR] QRCraft did not become ready within 120 seconds.
  echo Check the "QRCraft Server" window for the underlying error.
  echo.
  pause
  exit /b 1
)

echo.
echo   QRCraft is ready.
echo   Preview: %URL%
echo.

if /I not "%QRCRAFT_NO_BROWSER%"=="1" (
  start "" "%URL%"
  echo   A browser window has been opened.
) else (
  echo   Browser launch skipped because QRCRAFT_NO_BROWSER=1.
)

echo.
echo   Keep the "QRCraft Server" window open while using the app.
echo   Press any key to close this launcher window.
pause >nul
exit /b 0
