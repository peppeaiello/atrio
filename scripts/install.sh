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

	# The helper scripts come from GitHub, or from a local folder when ATRIO_SOURCE points at
	# a checkout's scripts/ (to try changes before they are published)
	install_script() {
		if [ -n "${ATRIO_SOURCE:-}" ]; then
			cp "$ATRIO_SOURCE/$1" "/usr/local/bin/$1.tmp"
		else
			curl -fsSL --connect-timeout 20 --max-time 120 -o "/usr/local/bin/$1.tmp" "$RAW/scripts/$1"
		fi
		chmod 755 "/usr/local/bin/$1.tmp"
		mv "/usr/local/bin/$1.tmp" "/usr/local/bin/$1"
	}

	# Updater: Atrio writes $STATE/update-request through the CasaOS file API,
	# the path unit sees it and runs atrio-update as root.
	install_script atrio-update
	# Push alerts: checks the server every 5 minutes and sends warnings to ntfy or Gotify,
	# as set in Atrio's settings ($STATE/alerts.conf)
	install_script atrio-alerts

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

	# CasaOS updates put their own UI back: this puts Atrio back after them
	cat > /etc/systemd/system/atrio-restore.service <<'UNIT'
[Unit]
Description=Put Atrio back after a CasaOS update replaces the web UI

[Service]
Type=oneshot
ExecStart=/usr/local/bin/atrio-update --restore
TimeoutStartSec=10min
UNIT

	cat > /etc/systemd/system/atrio-restore.path <<'UNIT'
[Unit]
Description=Watch the CasaOS web UI for updates that replace Atrio

[Path]
PathChanged=/var/lib/casaos/www/index.html

[Install]
WantedBy=multi-user.target
UNIT

	cat > /etc/systemd/system/atrio-alerts.service <<'UNIT'
[Unit]
Description=Send Atrio's warnings to ntfy or Gotify
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/atrio-alerts
TimeoutStartSec=3min
UNIT

	cat > /etc/systemd/system/atrio-alerts.timer <<'UNIT'
[Unit]
Description=Check the server for Atrio's push alerts every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT

	# "Send a test" in the settings writes $STATE/alerts-test
	cat > /etc/systemd/system/atrio-alerts-test.service <<'UNIT'
[Unit]
Description=Send a test push alert for Atrio

[Service]
Type=oneshot
ExecStart=/usr/local/bin/atrio-alerts --test
TimeoutStartSec=1min
UNIT

	cat > /etc/systemd/system/atrio-alerts-test.path <<'UNIT'
[Unit]
Description=Watch for test requests from Atrio's push alert settings

[Path]
PathExists=/var/lib/casaos/atrio/alerts-test

[Install]
WantedBy=multi-user.target
UNIT

	systemctl daemon-reload
	systemctl enable --now atrio-update.path >/dev/null
	systemctl enable --now atrio-restore.path >/dev/null
	systemctl enable --now atrio-alerts.timer >/dev/null
	systemctl enable --now atrio-alerts-test.path >/dev/null
	# A first run writes the status the settings read (alerts stay off until set up there)
	/usr/local/bin/atrio-alerts || true

	/usr/local/bin/atrio-update --force

	echo
	echo "Done: open CasaOS in your browser and reload the page (Ctrl+F5)."
	echo "To go back to the CasaOS UI: curl -fsSL $RAW/scripts/uninstall.sh | sudo bash"
}

main "$@"
