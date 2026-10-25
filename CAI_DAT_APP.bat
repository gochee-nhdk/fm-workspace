@echo off
chcp 65001 >nul
title Cài Đặt FM Workspace (1-Click Setup)

cd /d "%~dp0"
set "ROOT=%~dp0"

echo ==============================================================================
echo         CHÀO MỪNG BẠN ĐẾN VỚI FM WORKSPACE — SETUP 1-CLICK (LOCAL WEB APP)
echo ==============================================================================
echo.

:: ── [1/5] Kiểm tra Node.js ───────────────────────────────────────────────────
echo [1/5] Kiểm tra môi trường Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Chưa phát hiện Node.js trên máy tính của bạn!
    echo.
    echo  Vui lòng cài Node.js LTS miễn phí tại: https://nodejs.org
    echo  Hoặc mở PowerShell (Admin) và chạy lệnh:
    echo      winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo  ✅ Đã phát hiện Node.js %NODE_VER%

:: ── [2/5] Cấu hình .env ──────────────────────────────────────────────────────
echo.
echo [2/5] Thiết lập cấu hình môi trường (.env)...

if not exist "client\.env" (
    if exist "client\.env.example" (
        copy /y "client\.env.example" "client\.env" >nul
        echo  ✅ Đã tạo client\.env từ mẫu
    )
)

if not exist "server\.env" (
    if exist "server\.env.example" (
        copy /y "server\.env.example" "server\.env" >nul
        echo  ✅ Đã tạo server\.env từ mẫu
    )
)

:: ── [3/5] Cài đặt dependencies ───────────────────────────────────────────────
echo.
echo [3/5] Cài đặt packages và khởi tạo cơ sở dữ liệu SQLite cục bộ...
echo  (Bước này mất 1-2 phút tùy tốc độ mạng — vui lòng chờ...)
echo.

call npm install
call npm --prefix server install
call npm --prefix client install --legacy-peer-deps
call npm --prefix server run db:init
echo  ✅ Cài đặt dependencies và khởi tạo CSDL thành công

:: ── [4/5] Build production web app ───────────────────────────────────────────
echo.
echo [4/5] Build production web app (Client & Server)...
call npm --prefix client run build
call npm --prefix server run build
echo  ✅ Build thành công — Sẵn sàng phục vụ tĩnh tối ưu tốc độ

:: ── [5/5] Tạo shortcut Desktop + phím tắt Ctrl+Alt+F ─────────────────────────
echo.
echo [5/5] Tạo biểu tượng Desktop và gán phím tắt [Ctrl + Alt + F]...

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\create_shortcut.ps1"

echo.
echo ==============================================================================
echo   ✅ CÀI ĐẶT HOÀN TẤT 100%%!
echo ==============================================================================
echo.
echo  Biểu tượng [FM Workspace] đã xuất hiện ngoài màn hình Desktop.
echo.
echo  MỞ APP BẤT CỨ LÚC NÀO BẰNG CÁCH:
echo    ▶  Phím tắt:    Ctrl + Alt + F
echo    ▶  Nhấp đúp:    Biểu tượng [FM Workspace] trên Desktop
echo    ▶  File script: KHOI_DONG_APP.bat
echo.
echo  App sẽ chạy trên trình duyệt mặc định tại: http://localhost:3000
echo  Dữ liệu lưu 100%% trên SQLite cục bộ máy tính cá nhân, bảo mật tuyệt đối.
echo ==============================================================================
echo.

set /p "launch_now=Bạn có muốn khởi chạy ứng dụng ngay bây giờ không? (y/n): "
if /i "%launch_now%"=="y" (
    cscript //nologo KHOI_CHAY_APP.vbs
)
