#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE — START SCRIPT (macOS & Linux)
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

open_browser() {
    local url="$1"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$url" 2>/dev/null || true
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" 2>/dev/null || true
    fi
}

# 1. Kiểm tra nếu server port 3000 đang chạy -> mở ngay trình duyệt mặc định
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] FM Workspace đang chạy trên port 3000 → Mở trình duyệt mặc định...${NC}"
    open_browser "http://localhost:3000"
    exit 0
fi

# 2. Khởi động đúng chế độ
if [ -f "client/dist/index.html" ] && [ -f "server/dist/index.js" ]; then
    echo "[INFO] Khởi động production server (port 3000)..."
    PORT=3000 node server/dist/index.js >/dev/null 2>&1 &
    echo $! > .fm_server.pid
else
    echo "[INFO] Chưa có bản build production, chạy chế độ development..."
    npm run dev >/dev/null 2>&1 &
    echo $! > .fm_server.pid
fi

# 3. Đợi server sẵn sàng và mở trình duyệt
for i in $(seq 1 30); do
    sleep 1
    if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] FM Workspace sẵn sàng!${NC}"
        open_browser "http://localhost:3000"
        exit 0
    elif lsof -i :5173 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] Dev server sẵn sàng!${NC}"
        open_browser "http://localhost:5173"
        exit 0
    fi
done

open_browser "http://localhost:3000"
