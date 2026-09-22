@echo off
setlocal
chcp 65001 >nul
title FARMERS MARKET - TRO LY THU MUA & SECURITY GUARDIAN
color 0B

echo =====================================================================
echo    HE THONG TRO LY THU MUA ^& QUAN TRI - FARMERS MARKET
echo    Tich hop Security Guardian Agent (Chong xung dot ^& Tu dong bao ve)
echo    Vi tri cai dat: D:\trợ lý thu mua
echo =====================================================================
echo.

cd /d "%~dp0"

:: Kiem tra Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [LOI] Chua tim thay Node.js tren may tinh cua ban!
    echo Vui long cai dat Node.js tu https://nodejs.org/ de khoi chay he thong.
    pause
    exit /b 1
)

echo Dang khoi chay Security Guardian Agent va kiem tra he thong...
echo (He thong se tu dong mo ung dung tren Microsoft Edge khi san sang)
echo.

node "%~dp0security-guardian.cjs"

echo.
pause
