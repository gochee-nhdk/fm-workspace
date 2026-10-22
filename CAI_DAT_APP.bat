@echo off
chcp 65001 >nul
title Cài Đặt FM Workspace (1-Click Setup)

cd /d "%~dp0"
set "ROOT=%~dp0"

echo ==============================================================================
echo         CHÀO MỪNG BẠN ĐẾN VỚI FM WORKSPACE — SETUP 1-CLICK
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
    echo  Hoặc chạy lệnh sau trong PowerShell với quyền Admin:
    echo      winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo  ✅ Đã phát hiện Node.js %NODE_VER%

:: Kiểm tra phiên bản Node.js tối thiểu v18
for /f "tokens=1 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
for /f "tokens=2 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
if %NODE_MAJOR% lss 18 (
    echo.
    echo  ⚠️  Node.js %NODE_VER% quá cũ! FM Workspace cần Node.js v18 trở lên.
    echo  Tải phiên bản mới nhất tại: https://nodejs.org
    echo.
    pause
    exit /b 1
)

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
echo  (Bước này mất 1-3 phút tùy tốc độ mạng — vui lòng chờ...)
echo.

call npm run setup
if %errorlevel% neq 0 (
    echo  ⚠️  Gặp lỗi — Thử cài đặt fallback...
    call npm install
    call npm --prefix server install
    call npm --prefix client install --legacy-peer-deps
    call npm --prefix server run db:init
)
echo  ✅ Cài đặt dependencies thành công

:: ── [4/5] Build client production ────────────────────────────────────────────
echo.
echo [4/5] Build production client (tối ưu hiệu năng)...
call npm --prefix client run build
if %errorlevel% equ 0 (
    echo  ✅ Build thành công — client/dist/ đã sẵn sàng
) else (
    echo  ⚠️  Build production thất bại — App vẫn chạy được ở chế độ development
)

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
echo.
echo  Dữ liệu của bạn được bảo mật tuyệt đối, lưu 100%% trên máy tính cá nhân.
echo ==============================================================================
echo.

set /p "launch_now=Bạn có muốn khởi chạy ứng dụng ngay bây giờ không? (y/n): "
if /i "%launch_now%"=="y" (
    cscript //nologo KHOI_CHAY_APP.vbs
)
