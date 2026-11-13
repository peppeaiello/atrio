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
	for tool in curl tar sha256sum flock gpgv; do
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

	# The services come from the latest release on GitHub, signed like the UI it installs, never
	# from work in progress on main. ATRIO_SOURCE points at a checkout's scripts/ to try changes
	# before they are published.
	local TAG=""
	if [ -z "${ATRIO_SOURCE:-}" ]; then
		TAG=$(curl -fsSLI -o /dev/null -w '%{url_effective}' --connect-timeout 20 --max-time 60 \
			"https://github.com/$REPO/releases/latest" | sed -n 's|.*/releases/tag/||p')
		if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
			echo "Could not find the latest Atrio release on GitHub." >&2
			exit 1
		fi
		echo "Installing Atrio $TAG"
	fi
	# The services come from the same place: the release's signed server bundle, or the checkout
	SERVER_TMP=$(mktemp -d)
	trap 'rm -rf "$SERVER_TMP"' EXIT
	local SERVER="$SERVER_TMP"
	echo "Downloading the updater, push alerts and backups..."
	if [ -n "${ATRIO_SOURCE:-}" ]; then
		cp "$ATRIO_SOURCE"/atrio-update "$ATRIO_SOURCE"/atrio-alerts "$ATRIO_SOURCE"/atrio-backup \
			"$ATRIO_SOURCE"/atrio-setup "$ATRIO_SOURCE"/atrio-release-key.gpg "$SERVER/"
	else
		local base="https://github.com/$REPO/releases/download/$TAG"
		# The key comes from the repository at that tag; the bundle must be signed with it
		curl -fsSL --connect-timeout 20 --max-time 120 -o "$SERVER/key.gpg" \
			"https://raw.githubusercontent.com/$REPO/$TAG/scripts/atrio-release-key.gpg"
		if ! curl -fsSL --connect-timeout 20 --max-time 300 -o "$SERVER/atrio-server.tar.gz" "$base/atrio-server.tar.gz" ||
			! curl -fsSL --connect-timeout 20 --max-time 120 -o "$SERVER/atrio-server.tar.gz.sig" "$base/atrio-server.tar.gz.sig"; then
			echo "Atrio $TAG has no server bundle: this install script needs Atrio 0.1.17 or newer." >&2
			exit 1
		fi
		if ! gpgv --keyring "$SERVER/key.gpg" "$SERVER/atrio-server.tar.gz.sig" "$SERVER/atrio-server.tar.gz" >/dev/null 2>&1; then
			echo "The server bundle of Atrio $TAG is not signed by Atrio: nothing was installed." >&2
			exit 1
		fi
		mkdir "$SERVER/files"
		tar -xzf "$SERVER/atrio-server.tar.gz" -C "$SERVER/files" --no-same-owner --no-same-permissions
		if [ -n "$(find "$SERVER/files" -mindepth 1 ! -type f)" ]; then
			echo "The server bundle of Atrio $TAG contains unexpected files: nothing was installed." >&2
			exit 1
		fi
		SERVER="$SERVER/files"
	fi

	bash "$SERVER/atrio-setup" "$SERVER"
	# The updater then knows the services already match this release
	if [ -n "$TAG" ]; then
		echo "${TAG#v}" > "$STATE/server-version"
	else
		rm -f "$STATE/server-version"
	fi

	# The services just set up from a checkout stay: the updater installs only the web UI then
	if [ -n "${ATRIO_SOURCE:-}" ]; then
		ATRIO_KEEP_SERVER=1 /usr/local/bin/atrio-update --force
	else
		/usr/local/bin/atrio-update --force
	fi

	echo
	echo "Done: open CasaOS in your browser and reload the page (Ctrl+F5)."
	echo "To go back to the CasaOS UI: curl -fsSL $RAW/scripts/uninstall.sh | sudo bash"
}

main "$@"
