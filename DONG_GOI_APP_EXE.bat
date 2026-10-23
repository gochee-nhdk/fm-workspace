@echo off
chcp 65001 >nul
title Đóng gói FM Workspace thành file cài đặt .exe

echo ========================================================
echo   FM WORKSPACE - ĐÓNG GÓI ỨNG DỤNG DESKTOP (.EXE)
echo ========================================================
echo.
echo [*] Đang biên dịch frontend và backend...
call npm run build:all
if %errorlevel% neq 0 (
    echo [!] Lỗi khi biên dịch mã nguồn. Vui lòng kiểm tra lại.
    pause
    exit /b %errorlevel%
)

echo.
echo [*] Đang biên dịch Electron Shell...
call npm run build:electron
if %errorlevel% neq 0 (
    echo [!] Lỗi khi biên dịch Electron.
    pause
    exit /b %errorlevel%
)

echo.
echo [*] Đang tạo file cài đặt Windows (.exe installer)...
call npx electron-builder --win
if %errorlevel% neq 0 (
    echo [!] Lỗi khi đóng gói installer.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo [THÀNH CÔNG] File cài đặt đã được tạo tại:
echo   dist-electron\FM Workspace Setup 1.0.0.exe
echo ========================================================
echo.
pause
