#!/usr/bin/env bash
# ==============================================================================
# FM WORKSPACE - STOP SCRIPT FOR MACOS & LINUX
# ==============================================================================
echo "[INFO] Đang dừng FM Workspace..."

# Kill process on port 5173
PID_CLIENT=$(lsof -t -i :5173 2>/dev/null || true)
if [ -n "$PID_CLIENT" ]; then
    kill -9 $PID_CLIENT 2>/dev/null || true
fi

# Kill process on port 3000
PID_SERVER=$(lsof -t -i :3000 2>/dev/null || true)
if [ -n "$PID_SERVER" ]; then
    kill -9 $PID_SERVER 2>/dev/null || true
fi

echo "[OK] Đã dừng FM Workspace thành công!"
