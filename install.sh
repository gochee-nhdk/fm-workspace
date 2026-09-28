#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE - 1-CLICK SETUP SCRIPT FOR MACOS & LINUX
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================================================="
echo "       CHÀO MỪNG BẠN ĐẾN VỚI FM WORKSPACE (MACOS / LINUX EDITION)"
echo "=============================================================================="
echo ""

# 1. Kiểm tra Node.js
echo "[1/4] Đang kiểm tra Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "[LỖI] Chưa phát hiện Node.js trên máy!"
    echo "Vui lòng cài đặt Node.js LTS (v18+) tại https://nodejs.org"
    echo "Trên macOS (Homebrew): brew install node"
    echo "Trên Ubuntu/Debian: sudo apt update && sudo apt install -y nodejs npm"
    exit 1
fi
echo "[OK] Node.js version: $(node -v)"

# 2. Cấu hình .env
echo ""
echo "[2/4] Thiết lập cấu hình môi trường (.env)..."
if [ ! -f "client/.env" ] && [ -f "client/.env.example" ]; then
    cp "client/.env.example" "client/.env"
    echo "[OK] Đã tạo client/.env"
fi

if [ ! -f "server/.env" ] && [ -f "server/.env.example" ]; then
    cp "server/.env.example" "server/.env"
    echo "[OK] Đã tạo server/.env"
fi

# 3. Cài đặt dependencies
echo ""
echo "[3/4] Cài đặt dependencies và khởi tạo cơ sở dữ liệu..."
npm run setup || {
    echo "[CẢNH BÁO] Chạy fallback cài đặt..."
    npm install
    npm --prefix server install
    npm --prefix client install --legacy-peer-deps
    npm --prefix server run db:init
}

# 4. Cấp quyền thực thi cho các file shell
chmod +x start.sh stop.sh 2>/dev/null || true

echo ""
echo "=============================================================================="
echo "[HOÀN TẤT] CÀI ĐẶT THÀNH CÔNG 100%!"
echo "Khởi chạy ứng dụng bằng lệnh: ./start.sh"
echo "Dừng ứng dụng bằng lệnh:      ./stop.sh"
echo "=============================================================================="
