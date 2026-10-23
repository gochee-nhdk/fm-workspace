@echo off
chcp 65001 >nul
title Mở thư mục chứa file cài đặt FM Workspace

echo ========================================================
echo   FM WORKSPACE - FILE CÀI ĐẶT DESKTOP (.EXE)
echo ========================================================
echo.
echo [*] Thư mục chứa file cài đặt:
echo     %~dp0dist-electron
echo.
echo [*] Các file có sẵn:
echo     1. FM Workspace Setup 1.0.0.exe  (Bản cài đặt tự động)
echo     2. FM-Workspace-Portable.zip     (Bản Portable giải nén dùng ngay)
echo     3. checksums.sha256              (Mã băm xác thực Microsoft)
echo.
echo [*] Đang mở thư mục trong Windows Explorer...
explorer.exe "%~dp0dist-electron"

echo.
echo ========================================================
echo Bạn có thể copy file .exe hoặc .zip này để cài đặt ngay
echo trên máy tính của bạn hoặc gửi cho đồng nghiệp!
echo ========================================================
echo.
pause
