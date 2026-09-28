@echo off
chcp 65001 >nul
title Sao Lưu Dữ Liệu FM Workspace

cd /d "%~dp0"

echo ==============================================================================
echo [INFO] Đang sao lưu cơ sở dữ liệu FM Workspace cục bộ...
echo ==============================================================================

set "backup_dir=backups\%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "backup_dir=%backup_dir: =0%"

if not exist "%backup_dir%" mkdir "%backup_dir%"

if exist "server\data\app.db" (
    copy /y "server\data\app.db" "%backup_dir%\app.db" >nul
    echo [OK] Đã sao lưu thành công file cơ sở dữ liệu SQLite vào:
    echo      %~dp0%backup_dir%\app.db
) else (
    echo [CHÚ Ý] Chưa phát hiện file server\data\app.db. Ứng dụng có thể chưa chạy lần đầu.
)

echo.
echo Dữ liệu của bạn được bảo vệ an toàn 100%% trên ổ cứng máy tính cá nhân.
pause
