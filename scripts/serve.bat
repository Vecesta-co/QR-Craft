@echo off
setlocal
cd /d "%~dp0.."
title QRCraft Server

echo.
echo   QRCraft production server
echo   -------------------------
echo   Local address: http://127.0.0.1:3000
echo   Close this window to stop the server.
echo.

call npm run start -- -p 3000

echo.
echo [QRCraft server stopped]
echo If this was unexpected, review the error output above, then run start.bat again.
echo.
pause
