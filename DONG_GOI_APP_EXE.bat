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
echo [*] Đang tạo file cài đặt Windows (.exe installer & portable)...
call npx electron-builder --win
if %errorlevel% neq 0 (
    echo [!] Lỗi khi đóng gói installer.
    pause
    exit /b %errorlevel%
)

echo.
echo [*] Đang nén bản Portable .zip để tải nhanh...
powershell -NoProfile -Command "Compress-Archive -Path 'dist-electron\win-unpacked\*' -DestinationPath 'dist-electron\FM-Workspace-Portable.zip' -Force"

echo.
echo [*] Đang tạo mã băm SHA-256 xác thực bảo mật...
powershell -NoProfile -Command "Get-FileHash -Path 'dist-electron\*.exe' -Algorithm SHA256 | Out-File -FilePath 'dist-electron\checksums.sha256'"

echo.
echo ========================================================
echo [THÀNH CÔNG] Sản phẩm đã được tạo tại thư mục dist-electron/:
echo   1. File cài đặt: dist-electron\FM Workspace Setup 1.0.0.exe
echo   2. Bản Portable: dist-electron\FM-Workspace-Portable.zip
echo   3. Mã SHA-256:   dist-electron\checksums.sha256
echo ========================================================
echo.
pause
