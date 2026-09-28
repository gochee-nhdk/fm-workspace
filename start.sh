#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE - START SCRIPT FOR MACOS & LINUX
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if port 5173 is already active
if lsof -i :5173 >/dev/null 2>&1; then
    echo "[INFO] FM Workspace đang chạy. Mở trình duyệt..."
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:5173"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:5173"
    fi
    exit 0
fi

echo "[INFO] Đang khởi chạy FM Workspace..."
npm run dev >/dev/null 2>&1 &
PID=$!

echo "[INFO] Đang chờ ứng dụng sẵn sàng..."
for i in {1..10}; do
    sleep 1
    if lsof -i :5173 >/dev/null 2>&1; then
        break
    fi
done

echo "[INFO] Mở trình duyệt tại http://localhost:5173"
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173"
fi
