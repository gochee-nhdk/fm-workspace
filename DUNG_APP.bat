@echo off
chcp 65001 >nul
title Dừng FM Workspace

echo ==============================================================================
echo [INFO] Đang dừng ứng dụng FM Workspace trên máy...
echo ==============================================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [OK] Đã tắt FM Workspace và giải phóng cổng mạng thành công!
timeout /t 2 >nul
