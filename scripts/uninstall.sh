#!/bin/bash
# Removes Atrio and puts back the CasaOS web UI saved by install.sh.
#
#   curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/uninstall.sh | sudo bash
set -euo pipefail

WWW="/var/lib/casaos/www"
STATE="/var/lib/casaos/atrio"
BACKUP="$STATE/casaos-ui-original"

if [ "$(id -u)" -ne 0 ]; then
	echo "Run it as root (with sudo)." >&2
	exit 1
fi

systemctl disable --now atrio-update.path >/dev/null 2>&1 || true
rm -f /etc/systemd/system/atrio-update.path /etc/systemd/system/atrio-update.service /usr/local/bin/atrio-update
systemctl daemon-reload

if [ -f "$BACKUP/index.html" ]; then
	if command -v rsync >/dev/null; then
		rsync -a --delete "$BACKUP/" "$WWW/"
	else
		rm -rf "$WWW" && cp -a "$BACKUP" "$WWW"
	fi
	chown -R root:root "$WWW"
	rm -rf "$STATE"
	echo "CasaOS UI restored. Reload the page in your browser (Ctrl+F5)."
else
	echo "No copy of the CasaOS UI was found in $BACKUP: Atrio's updater is removed, but the UI in $WWW is unchanged." >&2
	echo "Reinstalling or updating CasaOS puts its UI back." >&2
	exit 1
fi
