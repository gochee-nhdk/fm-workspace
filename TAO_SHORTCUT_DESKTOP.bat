@echo off
chcp 65001 >nul
title Tạo Lại Phím Tắt FM Workspace Desktop

cd /d "%~dp0"
echo Đang tạo biểu tượng Desktop và phím tắt [Ctrl + Alt + F]...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create_shortcut.ps1"
echo.
pause
