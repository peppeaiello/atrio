#!/bin/bash
# Installs Atrio in place of the CasaOS web UI, keeping a copy of the original,
# and sets up updates from Atrio's settings.
#
#   curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
set -euo pipefail

REPO="peppeaiello/atrio"
RAW="https://raw.githubusercontent.com/$REPO/main"
WWW="/var/lib/casaos/www"
STATE="/var/lib/casaos/atrio"
BACKUP="$STATE/casaos-ui-original"

if [ "$(id -u)" -ne 0 ]; then
	echo "Run it as root: curl -fsSL $RAW/scripts/install.sh | sudo bash" >&2
	exit 1
fi
if [ ! -f "$WWW/index.html" ] || ! command -v systemctl >/dev/null; then
	echo "CasaOS was not found on this machine ($WWW is missing)." >&2
	exit 1
fi
for tool in curl tar sha256sum; do
	command -v "$tool" >/dev/null || { echo "Missing command: $tool" >&2; exit 1; }
done

mkdir -p "$STATE"

# Keep the original CasaOS UI, unless what is installed is already Atrio
if [ ! -d "$BACKUP" ]; then
	if [ -f "$WWW/atrio-version.json" ] || grep -q "<title>[[:space:]]*Atrio" "$WWW/index.html"; then
		echo "Atrio is already installed and no copy of the CasaOS UI was found: skipping the backup."
	else
		cp -a "$WWW" "$BACKUP"
		echo "Original CasaOS UI saved in $BACKUP"
	fi
fi

# Updater: Atrio creates $STATE/update-request through the CasaOS file API,
# the path unit sees it and runs atrio-update as root.
curl -fsSL -o /usr/local/bin/atrio-update "$RAW/scripts/atrio-update"
chmod 755 /usr/local/bin/atrio-update

cat > /etc/systemd/system/atrio-update.service <<'UNIT'
[Unit]
Description=Install the latest Atrio web UI for CasaOS

[Service]
Type=oneshot
ExecStart=/usr/local/bin/atrio-update
UNIT

cat > /etc/systemd/system/atrio-update.path <<'UNIT'
[Unit]
Description=Watch for update requests from the Atrio web UI

[Path]
PathExists=/var/lib/casaos/atrio/update-request

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now atrio-update.path >/dev/null

/usr/local/bin/atrio-update --force

echo
echo "Done: open CasaOS in your browser and reload the page (Ctrl+F5)."
echo "To go back to the CasaOS UI: curl -fsSL $RAW/scripts/uninstall.sh | sudo bash"
