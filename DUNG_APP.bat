@echo off
setlocal
chcp 65001 >nul
title FARMERS MARKET - DUNG UNG DUNG & SECURITY GUARDIAN
color 0C

echo =====================================================================
echo    DUNG HE THONG TRO LY THU MUA - FARMERS MARKET
echo =====================================================================
echo.

cd /d "%~dp0"

echo Dang gui tin hieu dung an toan den Security Guardian Agent...
node "%~dp0security-guardian.cjs" --stop

echo.
echo =====================================================================
echo  DA DUNG TOAN BO HE THONG AN TOAN ^& GIAI PHONG TAI NGUYEN!
echo  - Cac tien trinh ngam da duoc dong.
echo  - Cong mang 3000 va 5173 da duoc giai phong.
echo  - Ban co the khoi dong lai bat ky luc nao bang shortcut hoac file VBS.
echo =====================================================================
echo.
pause
