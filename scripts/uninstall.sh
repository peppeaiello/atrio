#!/bin/bash
# Removes Atrio and puts back the CasaOS web UI saved by install.sh.
#
#   curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/uninstall.sh | sudo bash
set -euo pipefail

main() {
	local WWW="/var/lib/casaos/www"
	local STATE="/var/lib/casaos/atrio"
	local BACKUP="$STATE/casaos-ui-original"

	if [ "$(id -u)" -ne 0 ]; then
		echo "Run it as root (with sudo)." >&2
		exit 1
	fi
	if [ ! -f "$BACKUP/index.html" ]; then
		echo "No copy of the CasaOS UI was found in $BACKUP, nothing was changed." >&2
		echo "Reinstalling or updating CasaOS puts its UI back." >&2
		exit 1
	fi

	# The restore watcher would otherwise put Atrio straight back
	systemctl disable --now atrio-update.path atrio-restore.path >/dev/null 2>&1 || true
	systemctl stop atrio-restore.service >/dev/null 2>&1 || true

	# Stage the CasaOS UI next to the live folder, then swap with a rollback
	rm -rf "$WWW.new" "$WWW.old"
	cp -a "$BACKUP" "$WWW.new"
	# Browsers may still have Atrio's index.html cached (the gateway answers 304 to it): keep its
	# files and leave a version that differs from any release, so it reloads into CasaOS
	if [ -d "$WWW/assets" ]; then
		cp -a "$WWW/assets" "$WWW.new/assets"
	fi
	echo '{"version":"uninstalled"}' > "$WWW.new/atrio-version.json"
	chown -R root:root "$WWW.new"
	mv "$WWW" "$WWW.old"
	if ! mv "$WWW.new" "$WWW"; then
		mv "$WWW.old" "$WWW"
		echo "Could not restore the CasaOS UI, Atrio is still installed." >&2
		exit 1
	fi
	rm -rf "$WWW.old"
	# New file dates for the gateway, so browsers drop their cached Atrio
	systemctl try-restart casaos-gateway.service >/dev/null 2>&1 || true

	rm -f /etc/systemd/system/atrio-update.path /etc/systemd/system/atrio-update.service \
		/etc/systemd/system/atrio-restore.path /etc/systemd/system/atrio-restore.service /usr/local/bin/atrio-update
	systemctl daemon-reload
	rm -rf "$STATE"
	echo "CasaOS UI restored. Reload the page in your browser (Ctrl+F5)."
}

main "$@"
