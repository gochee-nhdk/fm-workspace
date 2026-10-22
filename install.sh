#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE — 1-CLICK SETUP SCRIPT (macOS & Linux)
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo "=============================================================================="
echo "         CHÀO MỪNG BẠN ĐẾN VỚI FM WORKSPACE — SETUP 1-CLICK"
echo "=============================================================================="
echo ""

# [1/5] Kiểm tra Node.js
echo "[1/5] Kiểm tra môi trường Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Chưa phát hiện Node.js!${NC}"
    echo "   Cài Node.js LTS tại: https://nodejs.org"
    echo "   macOS (Homebrew): brew install node"
    echo "   Ubuntu/Debian:    sudo apt install -y nodejs npm"
    exit 1
fi

NODE_VER=$(node -v)
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
echo -e "${GREEN}✅ Node.js ${NODE_VER}${NC}"

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Node.js ${NODE_VER} quá cũ! Cần v18+. Tải tại: https://nodejs.org${NC}"
    exit 1
fi

# [2/5] Cấu hình .env
echo ""
echo "[2/5] Thiết lập cấu hình môi trường (.env)..."
[ ! -f "client/.env" ] && [ -f "client/.env.example" ] && cp "client/.env.example" "client/.env" && echo -e "${GREEN}✅ Đã tạo client/.env${NC}"
[ ! -f "server/.env" ] && [ -f "server/.env.example" ] && cp "server/.env.example" "server/.env" && echo -e "${GREEN}✅ Đã tạo server/.env${NC}"

# [3/5] Cài đặt dependencies
echo ""
echo "[3/5] Cài đặt packages và khởi tạo cơ sở dữ liệu..."
echo "  (Mất 1-3 phút tùy tốc độ mạng — vui lòng chờ...)"
npm run setup || {
    echo -e "${YELLOW}⚠️  Fallback cài đặt...${NC}"
    npm install
    npm --prefix server install
    npm --prefix client install --legacy-peer-deps
    npm --prefix server run db:init
}
echo -e "${GREEN}✅ Cài đặt dependencies thành công${NC}"

# [4/5] Build production
echo ""
echo "[4/5] Build production client..."
npm --prefix client run build && echo -e "${GREEN}✅ Build thành công — client/dist/ sẵn sàng${NC}" \
    || echo -e "${YELLOW}⚠️  Build thất bại — App vẫn chạy được ở chế độ development${NC}"

# [5/5] Cấp quyền thực thi
echo ""
echo "[5/5] Cấu hình scripts..."
chmod +x start.sh stop.sh 2>/dev/null || true

echo ""
echo "=============================================================================="
echo -e "${GREEN}✅ CÀI ĐẶT HOÀN TẤT 100%!${NC}"
echo "=============================================================================="
echo ""
echo "  Khởi chạy app:  ./start.sh"
echo "  Dừng app:       ./stop.sh"
echo ""
echo "  Sau khi chạy start.sh, mở trình duyệt tại: http://localhost:3000"
echo "=============================================================================="
echo ""
read -p "Khởi chạy ngay bây giờ? (y/n): " launch_now
if [[ "$launch_now" =~ ^[Yy]$ ]]; then
    ./start.sh
fi
