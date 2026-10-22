@echo off
chcp 65001 >nul
title Khởi Động FM Workspace

cd /d "%~dp0"
call "%~dp0scripts\launch.bat"
