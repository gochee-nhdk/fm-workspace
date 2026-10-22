#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE — START SCRIPT (macOS & Linux)
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

# Kiểm tra production server (port 3000)
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] Server đang chạy trên port 3000${NC}"
    open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || true
    exit 0
fi

# Kiểm tra dev server (port 5173)
if lsof -i :5173 -sTCP:LISTEN >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] Dev server đang chạy trên port 5173${NC}"
    open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true
    exit 0
fi

# Khởi động đúng chế độ
if [ -f "client/dist/index.html" ]; then
    echo "[INFO] Khởi động production server..."
    PORT=3000 node server/dist/index.js &
    SERVER_PID=$!
    echo $SERVER_PID > .fm_server.pid

    echo -n "[INFO] Chờ server sẵn sàng"
    for i in $(seq 1 30); do
        sleep 1; echo -n "."
        if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}[OK] Server sẵn sàng!${NC}"
            open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || true
            exit 0
        fi
    done
    echo -e "${YELLOW}[TIMEOUT] Mở browser dù server chưa ready...${NC}"
    open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || true
else
    echo "[INFO] Chưa có bản build production. Chạy dev mode..."
    npm run dev &
    DEV_PID=$!
    echo $DEV_PID > .fm_server.pid

    echo -n "[INFO] Chờ dev server"
    for i in $(seq 1 30); do
        sleep 1; echo -n "."
        if lsof -i :5173 -sTCP:LISTEN >/dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}[OK] Dev server sẵn sàng!${NC}"
            open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true
            exit 0
        fi
    done
    echo -e "${YELLOW}[TIMEOUT] Mở browser dù server chưa ready...${NC}"
    open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true
fi
