@echo off
chcp 65001 >nul
title Khởi Chạy FM Workspace

cd /d "%~dp0\.."

:: Check if client port 5173 is already active
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [INFO] FM Workspace đang chạy. Đang mở trình duyệt...
    start http://localhost:5173
    exit /b 0
)

echo [INFO] Đang khởi động FM Workspace ngầm...
start /b cmd /c "npm run dev >nul 2>&1"

:: Wait up to 10 seconds for port 5173 to be ready
set /a attempts=0
:WAIT_LOOP
set /a attempts+=1
timeout /t 1 /nobreak >nul
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel% equ 0 goto OPEN_BROWSER

if %attempts% lss 10 goto WAIT_LOOP

:OPEN_BROWSER
echo [INFO] Mở trình duyệt web...
start http://localhost:5173
exit /b 0
