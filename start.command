#!/bin/bash
# Двойной клик — поднимает локальный сервер и открывает сайт в браузере.
cd "$(dirname "$0")" || exit 1
PORT=5173
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Сайт: http://localhost:$PORT   (закрыть окно — сервер остановится)"
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server "$PORT"
