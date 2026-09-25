#!/bin/sh
# Двойной клик — запускает Super Тёпа в браузере (http://localhost:8778)
cd "$(dirname "$0")" || exit 1
( sleep 1 && open "http://localhost:8778" ) &
exec python3 -m http.server 8778 --bind 127.0.0.1
