@echo off
chcp 65001 >nul
title FM Workspace — Đang khởi động...

cd /d "%~dp0\.."
set "ROOT=%~dp0\.."

:: ── Phase 1: Nếu production server (port 3000) đang chạy → mở ngay ──────────
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Server production đang chạy → Mở trình duyệt...
    start "" "http://localhost:3000"
    exit /b 0
)

:: ── Phase 2: Nếu dev server (port 5173) đang chạy → mở ngay ─────────────────
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Dev server đang chạy → Mở trình duyệt...
    start "" "http://localhost:5173"
    exit /b 0
)

:: ── Phase 3: Kiểm tra dist/ đã build chưa ────────────────────────────────────
if exist "%ROOT%\client\dist\index.html" (
    echo [INFO] Tìm thấy bản build production. Khởi động server...
    start /b cmd /c "node server\dist\index.js > nul 2>&1"
    goto WAIT_PROD
) else (
    echo [INFO] Chưa có bản build. Khởi động chế độ development...
    start /b cmd /c "npm run dev > nul 2>&1"
    goto WAIT_DEV
)

:: ── Chờ Production Server (port 3000) ────────────────────────────────────────
:WAIT_PROD
set /a attempts=0
:POLL_PROD
set /a attempts+=1
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 goto OPEN_PROD
if %attempts% lss 30 goto POLL_PROD
echo [CẢNH BÁO] Timeout 30s — Thử mở browser dù server chưa ready...
:OPEN_PROD
start "" "http://localhost:3000"
exit /b 0

:: ── Chờ Dev Server (port 5173) ───────────────────────────────────────────────
:WAIT_DEV
set /a attempts=0
:POLL_DEV
set /a attempts+=1
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 goto OPEN_DEV
if %attempts% lss 30 goto POLL_DEV
echo [CẢNH BÁO] Timeout 30s — Thử mở browser dù server chưa ready...
:OPEN_DEV
start "" "http://localhost:5173"
exit /b 0
