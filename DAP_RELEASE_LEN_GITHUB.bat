@echo off
chcp 65001 >nul
title Đẩy Release lên GitHub

echo ========================================================
echo   FM WORKSPACE - ĐẨY BẢN RELEASE LÊN GITHUB
echo ========================================================
echo.
echo [*] Đang kiểm tra kết nối với GitHub...
git push origin main --tags
if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo [THÀNH CÔNG] Đã đẩy mã nguồn và tag release lên GitHub!
    echo GitHub Actions sẽ tự động kích hoạt tạo Release tải về.
    echo ========================================================
) else (
    echo.
    echo [!] Cần đăng nhập tài khoản GitHub trong cửa sổ hiện lên.
)
echo.
pause
