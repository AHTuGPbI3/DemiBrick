#!/bin/bash
# ── DemiBrick Launcher ─────────────────────────────────────────────────────────

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill anything already on port 8000 or 3000
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null

osascript <<EOF
tell application "Terminal"
    -- Backend window
    do script "cd '$DIR' && ./start-backend.sh"
    set custom title of front window to "DemiBrick · Backend :8000"
    set current settings of front window to settings set "Pro"

    -- Frontend window
    do script "cd '$DIR' && ./start-frontend.sh"
    set custom title of front window to "DemiBrick · Frontend :3000"
end tell
EOF

echo "Starting…  Backend → http://localhost:8000  |  Frontend → http://localhost:3000"
sleep 5
open "http://localhost:3000"
