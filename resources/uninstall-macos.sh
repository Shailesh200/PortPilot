#!/bin/bash
# Removes PortPilot user data after the .app is deleted.
# Dragging PortPilot to Trash does not run this — run it from Terminal,
# or use Settings → Safety → Erase all PortPilot data while the app is open.
set -u

SUPPORT_NAMES=("port-pilot" "PortPilot")
CACHE_NAMES=("port-pilot" "PortPilot" "com.portpilot.app")

for name in "${SUPPORT_NAMES[@]}"; do
  rm -rf "$HOME/Library/Application Support/$name"
  rm -rf "$HOME/Library/Logs/$name"
done

for name in "${CACHE_NAMES[@]}"; do
  rm -rf "$HOME/Library/Caches/$name"
done

rm -f "$HOME/Library/Preferences/com.portpilot.app.plist"
rm -rf "$HOME/Library/Saved Application State/com.portpilot.app.savedState"

if [[ -x /usr/bin/security ]]; then
  while /usr/bin/security delete-generic-password -s "com.portpilot.app" >/dev/null 2>&1; do
    :
  done
  /usr/bin/security delete-generic-password -s "port-pilot Safe Storage" >/dev/null 2>&1 || true
fi

echo "PortPilot local data removed."
