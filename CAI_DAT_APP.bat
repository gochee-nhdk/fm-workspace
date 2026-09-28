@echo off
chcp 65001 >nul
title Cài Đặt FM Workspace (1-Click Setup)

cd /d "%~dp0"

echo ==============================================================================
echo        CHÀO MỪNG BẠN ĐẾN VỚI FM WORKSPACE (LOCAL-FIRST PERSONAL EDITION)
echo ==============================================================================
echo.
echo [1/4] Đang kiểm tra môi trường Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI] Chưa phát hiện Node.js trên máy tính của bạn!
    echo Vui lòng tải và cài đặt Node.js LTS miễn phí tại: https://nodejs.org
    echo Hoặc chạy lệnh sau trong PowerShell: winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Đã phát hiện Node.js phiên bản %NODE_VER%

echo.
echo [2/4] Thiết lập cấu hình môi trường (.env)...
if not exist "client\.env" (
    if exist "client\.env.example" (
        copy /y "client\.env.example" "client\.env" >nul
        echo [OK] Đã tạo client\.env từ client\.env.example
    )
)

if not exist "server\.env" (
    if exist "server\.env.example" (
        copy /y "server\.env.example" "server\.env" >nul
        echo [OK] Đã tạo server\.env từ server\.env.example
    )
)

echo.
echo [3/4] Cài đặt các gói phụ thuộc và khởi tạo cơ sở dữ liệu SQLite cục bộ...
call npm run setup
if %errorlevel% neq 0 (
    echo [CẢNH BÁO] Quá trình cài đặt gói gặp sự cố. Đang thử chạy npm install cơ bản...
    call npm install
    call npm --prefix server install
    call npm --prefix client install --legacy-peer-deps
    call npm --prefix server run db:init
)

echo.
echo [4/4] Đang tạo biểu tượng Desktop và gán phím tắt [Ctrl + Alt + F]...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$desk = [Environment]::GetFolderPath('Desktop'); " ^
    "$sc = $ws.CreateShortcut(\"$desk\FM Workspace.lnk\"); " ^
    "$sc.TargetPath = \"$($ws.CurrentDirectory)\KHOI_CHAY_APP.vbs\"; " ^
    "$sc.WorkingDirectory = \"$($ws.CurrentDirectory)\"; " ^
    "$sc.IconLocation = \"$($ws.CurrentDirectory)\client\public\favicon.ico\"; " ^
    "$sc.Description = 'FM Workspace - Trợ lý Thu Mua & Quản Lý Dữ Liệu Cá Nhân'; " ^
    "$sc.Hotkey = 'Ctrl+Alt+F'; " ^
    "$sc.Save();"

echo ==============================================================================
echo [HOÀN TẤT] CÀI ĐẶT THÀNH CÔNG 100%%!
echo ==============================================================================
echo.
echo Biểu tượng [FM Workspace] đã được tạo ngay ngoài màn hình Desktop.
echo.
echo BẠN CÓ THỂ MỞ APP BẤT CỨ LÚC NÀO BẰNG CÁCH:
echo   1. Bấm tổ hợp phím tắt:  Ctrl + Alt + F
echo   2. Hoặc nhấn đúp chuột vào biểu tượng [FM Workspace] trên Desktop
echo.
echo Dữ liệu của bạn được bảo mật tuyệt đối, lưu 100%% trên máy tính cá nhân.
echo ==============================================================================
echo.
set /p launch_now="Bạn có muốn khởi chạy ứng dụng ngay bây giờ không? (y/n): "
if /i "%launch_now%"=="y" (
    cscript //nologo KHOI_CHAY_APP.vbs
)
