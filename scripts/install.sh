#!/bin/bash
# Installs Atrio in place of the CasaOS web UI, keeping a copy of the original,
# and sets up updates from Atrio's settings.
#
#   curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
set -euo pipefail

# Everything runs from main(), so a download cut short by the network does nothing
main() {
	local REPO="peppeaiello/atrio"
	local RAW="https://raw.githubusercontent.com/$REPO/main"
	local WWW="/var/lib/casaos/www"
	local STATE="/var/lib/casaos/atrio"
	local BACKUP="$STATE/casaos-ui-original"

	if [ "$(id -u)" -ne 0 ]; then
		echo "Run it as root: curl -fsSL $RAW/scripts/install.sh | sudo bash" >&2
		exit 1
	fi
	if [ ! -f "$WWW/index.html" ] || ! command -v systemctl >/dev/null; then
		echo "CasaOS was not found on this machine ($WWW is missing)." >&2
		exit 1
	fi
	local tool
	for tool in curl tar sha256sum flock; do
		command -v "$tool" >/dev/null || { echo "Missing command: $tool" >&2; exit 1; }
	done

	mkdir -p "$STATE"

	# Keep a copy of the CasaOS UI whenever what is installed is not Atrio, so the copy also
	# follows CasaOS updates (which put their own UI back)
	if [ -f "$WWW/atrio-version.json" ] || grep -q "Atrio" "$WWW/index.html"; then
		[ -d "$BACKUP" ] || echo "Atrio is already installed and no copy of the CasaOS UI was found: skipping the backup."
	else
		rm -rf "$BACKUP.tmp"
		cp -a "$WWW" "$BACKUP.tmp"
		rm -rf "$BACKUP"
		mv "$BACKUP.tmp" "$BACKUP"
		echo "Original CasaOS UI saved in $BACKUP"
	fi

	# Updater: Atrio writes $STATE/update-request through the CasaOS file API,
	# the path unit sees it and runs atrio-update as root.
	curl -fsSL --connect-timeout 20 --max-time 120 -o /usr/local/bin/atrio-update.tmp "$RAW/scripts/atrio-update"
	chmod 755 /usr/local/bin/atrio-update.tmp
	mv /usr/local/bin/atrio-update.tmp /usr/local/bin/atrio-update

	cat > /etc/systemd/system/atrio-update.service <<'UNIT'
[Unit]
Description=Install the latest Atrio web UI for CasaOS

[Service]
Type=oneshot
ExecStart=/usr/local/bin/atrio-update
TimeoutStartSec=10min
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
}

main "$@"
