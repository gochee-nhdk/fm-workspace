#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE — STOP SCRIPT (macOS & Linux)
# ==============================================================================
echo "[INFO] Dừng FM Workspace..."

# Dừng server bằng PID file
if [ -f ".fm_server.pid" ]; then
    PID=$(cat .fm_server.pid)
    kill "$PID" 2>/dev/null && echo "[OK] Đã dừng server (PID $PID)" || true
    rm -f .fm_server.pid
fi

# Kill theo port phòng ngừa
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

echo "[OK] FM Workspace đã dừng hoàn toàn."
