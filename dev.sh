#!/bin/bash
# DemiBrick — open backend + frontend in two Terminal windows

DIR="$(cd "$(dirname "$0")" && pwd)"

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

echo "Opened: Backend → http://localhost:8000  |  Frontend → http://localhost:3000"
open "http://localhost:3000"
