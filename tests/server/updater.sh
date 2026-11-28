#!/bin/bash
# atrio-update and atrio-setup: a signed release installs the web UI and the services of that
# version; a release that is not signed by the release key, or a changed bundle, is refused.
. "$(dirname "$0")/lib.sh"
sandbox
export ATRIO_ROOT="$SB/root" GNUPGHOME="$SB/gnupg"
mkdir -p "$ATRIO_ROOT/etc/systemd/system" "$ATRIO_ROOT/usr/local/bin" "$GNUPGHOME" "$SB/rel" "$SB/build" "$ATRIO_WWW"
chmod 700 "$GNUPGHOME"

# A throwaway signing key, and a release 9.9.9 made like scripts/release.sh makes one
gpg --batch --quiet --passphrase '' --quick-gen-key "Atrio test key" ed25519 sign never 2>/dev/null
gpg --export > "$SB/key.gpg"
cp "$SB/key.gpg" "$SB/scripts-key.gpg"
echo '<html>Atrio</html>' > "$SB/build/index.html"
echo '{"version":"9.9.9"}' > "$SB/build/atrio-version.json"
tar -czf "$SB/rel/atrio.tar.gz" -C "$SB/build" .
(cd "$SB/rel" && sha256sum atrio.tar.gz > atrio.tar.gz.sha256)
mkdir "$SB/server" && cp "$SCRIPTS"/atrio-update "$SCRIPTS"/atrio-alerts "$SCRIPTS"/atrio-backup "$SCRIPTS"/atrio-setup "$SB/server/"
cp "$SB/key.gpg" "$SB/server/atrio-release-key.gpg"
echo 9.9.9 > "$SB/server/VERSION"
tar -czf "$SB/rel/atrio-server.tar.gz" -C "$SB/server" .
for file in atrio.tar.gz atrio-server.tar.gz; do gpg --batch --yes --detach-sign -o "$SB/rel/$file.sig" "$SB/rel/$file"; done
export ATRIO_DOWNLOAD="file://$SB/rel" ATRIO_RELEASE_KEY="$SB/key.gpg"
echo '<html>Atrio</html>' > "$ATRIO_WWW/index.html"
echo '{"version":"0.1.16"}' > "$ATRIO_WWW/atrio-version.json"
update() { bash "$SCRIPTS/atrio-update" "$@" >/dev/null 2>&1; }
status() { sed -n 's/.*"message":"\([^"]*\)".*/\1/p' "$ATRIO_STATE/update-status.json"; }

update
check "the new web UI is installed" has "$ATRIO_WWW/atrio-version.json" 9.9.9
check "with the services of the same release" test -x "$ATRIO_ROOT/usr/local/bin/atrio-backup"
check "and their timers" test -f "$ATRIO_ROOT/etc/systemd/system/atrio-check-updates.timer"
check "the release of the services is recorded" is "$(cat "$ATRIO_STATE/server-version")" 9.9.9
check "the update is in the activity log" has "$ATRIO_STATE/activity.log" "atrio-update	ok		9.9.9"
check "the status says it is installed" is "$(status)" "Atrio 9.9.9 installed"

rm -rf "${ATRIO_ROOT:?}/usr/local/bin/"*
update
check "a second run finds it installed" is "$(status)" "Atrio 9.9.9 is already installed"
check "and does not set the services up again" test ! -e "$ATRIO_ROOT/usr/local/bin/atrio-backup"

# Services older than the web UI (an update whose services failed): they are brought up to date
echo 9.9.8 > "$ATRIO_STATE/server-version"
update
check "services left behind are updated" test -x "$ATRIO_ROOT/usr/local/bin/atrio-backup"

# A bundle changed after it was signed is refused, and the services stay as they are
rm -rf "${ATRIO_ROOT:?}/usr/local/bin/"*
echo 9.9.8 > "$ATRIO_STATE/server-version"
cp "$SB/rel/atrio-server.tar.gz" "$SB/bundle.orig"
echo x >> "$SB/rel/atrio-server.tar.gz"
update
check "a changed bundle of services is refused" is "$(status)" "Atrio 9.9.9 is installed, but the services on the server could not be updated"
check "and installs nothing" test ! -e "$ATRIO_ROOT/usr/local/bin/atrio-backup"
cp "$SB/bundle.orig" "$SB/rel/atrio-server.tar.gz"

# A web UI that is not signed by the release key is never installed
echo '{"version":"0.1.16"}' > "$ATRIO_WWW/atrio-version.json"
mv "$SB/rel/atrio.tar.gz.sig" "$SB/sig.orig"
update
check "a release with no signature is refused" is "$(status)" "The release on GitHub is not signed by Atrio, so it was not installed"
check "and the web UI stays as it was" has "$ATRIO_WWW/atrio-version.json" 0.1.16
mv "$SB/sig.orig" "$SB/rel/atrio.tar.gz.sig"

# Trying a checkout's services (install.sh with ATRIO_SOURCE): the updater keeps them
rm -rf "${ATRIO_ROOT:?}/usr/local/bin/"* "$ATRIO_STATE/server-version"
ATRIO_KEEP_SERVER=1 bash "$SCRIPTS/atrio-update" --force >/dev/null 2>&1
check "with ATRIO_KEEP_SERVER only the web UI is installed" test ! -e "$ATRIO_ROOT/usr/local/bin/atrio-backup"

# After a CasaOS update put its own UI back: Atrio comes back, the services are not touched
echo '<html>CasaOS</html>' > "$ATRIO_WWW/index.html"
ATRIO_RESTORE_DELAY=0 bash "$SCRIPTS/atrio-update" --restore >/dev/null 2>&1
check "Atrio comes back after a CasaOS update" has "$ATRIO_WWW/index.html" Atrio
check "and keeps that CasaOS UI for the uninstaller" has "$ATRIO_STATE/casaos-ui-original/index.html" CasaOS
check "without touching the services" test ! -e "$ATRIO_ROOT/usr/local/bin/atrio-backup"

# Run from the web terminal of CasaOS or Atrio, the session closes when the gateway restarts: the
# hang-up and a terminal that is gone must not stop the update half way
echo '{"version":"0.1.16"}' > "$ATRIO_WWW/atrio-version.json"
rm -f "$ATRIO_STATE/update-status.json"
setsid bash "$SCRIPTS/atrio-update" 2>&- >&- &
pid=$!
sleep 0.5
kill -HUP -- "-$pid" 2>/dev/null
wait "$pid"
check "an update whose terminal hangs up still finishes" is "$(status)" "Atrio 9.9.9 installed"
check "and installs the new web UI" has "$ATRIO_WWW/atrio-version.json" 9.9.9

# Never back to an older release
echo '{"version":"10.0.0"}' > "$ATRIO_WWW/atrio-version.json"
update
check "an older release on GitHub is refused" is "$(status)" "The release on GitHub (9.9.9) is older than the installed one (10.0.0): nothing was changed"
check "and the web UI is left as it is" has "$ATRIO_WWW/atrio-version.json" 10.0.0

# After a CasaOS update, the restore never goes back below the newest release installed before
echo '<html>CasaOS</html>' > "$ATRIO_WWW/index.html"
echo 10.0.0 > "$ATRIO_STATE/highest-version"
ATRIO_RESTORE_DELAY=0 bash "$SCRIPTS/atrio-update" --restore >/dev/null 2>&1
check "a restore refuses a release older than one installed before" is "$(status)" "The release on GitHub (9.9.9) is older than one installed before (10.0.0): nothing was changed"
echo 9.9.9 > "$ATRIO_STATE/highest-version"
ATRIO_RESTORE_DELAY=0 bash "$SCRIPTS/atrio-update" --restore >/dev/null 2>&1
check "and puts back the same release" has "$ATRIO_WWW/index.html" Atrio

# The release on GitHub is older than the one installed (installed from a local build): the restore
# puts back the copy kept of the installed one
cp "$ATRIO_STATE"/release/atrio.tar.gz* "$SB/"
mkdir "$SB/newer"
cp "$SB/build/index.html" "$SB/newer/"
echo '{"version":"10.0.0"}' > "$SB/newer/atrio-version.json"
tar -czf "$ATRIO_STATE/release/atrio.tar.gz" -C "$SB/newer" .
(cd "$ATRIO_STATE/release" && sha256sum atrio.tar.gz > atrio.tar.gz.sha256)
echo 10.0.0 > "$ATRIO_STATE/highest-version"
echo '<html>CasaOS</html>' > "$ATRIO_WWW/index.html"
ATRIO_RESTORE_DELAY=0 bash "$SCRIPTS/atrio-update" --restore >/dev/null 2>&1
check "with an older release on GitHub, the installed one is restored" is "$(status)" "Atrio 10.0.0 installed"
check "from the copy kept of it" has "$ATRIO_WWW/atrio-version.json" 10.0.0
cp "$SB"/atrio.tar.gz* "$ATRIO_STATE/release/"
echo 9.9.9 > "$ATRIO_STATE/highest-version"
echo '{"version":"10.0.0"}' > "$ATRIO_WWW/atrio-version.json"

# Another update running: this one waits, and when it gives up leaves no request for the path unit
echo token > "$ATRIO_STATE/update-request"
( flock 9; sleep 4 ) 9>"$ATRIO_STATE/lock" &
sleep 0.5
ATRIO_LOCK_WAIT=1 bash "$SCRIPTS/atrio-update" >/dev/null 2>&1
wait
check "a request that could not run is not left behind" test ! -e "$ATRIO_STATE/update-request"

# atrio-setup alone: every service and unit, from a folder with the release's scripts
ATRIO_ROOT="$SB/root2" bash -c 'mkdir -p "$ATRIO_ROOT/etc/systemd/system" "$ATRIO_ROOT/usr/local/bin"; bash "$1" "$2"' _ "$SCRIPTS/atrio-setup" "$SB/server" >/dev/null 2>&1
units=$(ls "$SB/root2/etc/systemd/system" | wc -l)
check "atrio-setup writes all 14 units" is "$units" 14
check "it enables the timers" has "$FAKE_DOCKER/calls.log" "systemctl enable --now atrio-check-updates.timer"
check "the services are executable" is "$(stat -c %a "$SB/root2/usr/local/bin/atrio-update")" 755
check "and the release key is in place" test -s "$SB/root2/usr/local/share/atrio/release-key.gpg"
# The leftovers of 0.1.28 (withdrawn): Atrio's build of the CasaOS core goes, IceWhale's comes back
core_root() {
	r="$SB/root-core$1"
	mkdir -p "$r/etc/systemd/system" "$r/usr/local/bin" "$r/usr/local/share/atrio" "$r/usr/bin" "$r/state/core"
	echo "official casaos" > "$r/official"
	echo "atrio's casaos" > "$r/ours"
	cp "$r/ours" "$r/usr/bin/casaos"
	cp "$r/official" "$r/state/core/casaos.original"
	echo '{"state":"fixed"}' > "$r/state/core-status.json"
	touch "$r/usr/local/bin/atrio-core" "$r/etc/systemd/system/atrio-core.path" "$r/etc/systemd/system/atrio-core.service" "$r/usr/local/share/atrio/casaos-core"
	export ATRIO_OLD_CORES="$(sha256sum < "$r/ours" | cut -d' ' -f1)" ATRIO_OFFICIAL_CORES="$(sha256sum < "$r/official" | cut -d' ' -f1)"
}
core_setup() { ATRIO_ROOT="$r" ATRIO_STATE="$r/state" bash "$SCRIPTS/atrio-setup" "$SB/server" >/dev/null 2>&1; }
core_root 1
core_setup
check "the original CasaOS core is back" cmp -s "$r/usr/bin/casaos" "$r/official"
check "CasaOS is restarted for it" has "$FAKE_DOCKER/calls.log" "systemctl restart casaos"
check "atrio-core and its units are gone" test ! -e "$r/usr/local/bin/atrio-core" -a ! -e "$r/etc/systemd/system/atrio-core.path" -a ! -e "$r/etc/systemd/system/atrio-core.service"
check "and its manifest" test ! -e "$r/usr/local/share/atrio/casaos-core"
check "and what it kept" test ! -e "$r/state/core" -a ! -e "$r/state/core-status.json"
: > "$FAKE_DOCKER/calls.log"
core_setup
check "a second setup leaves CasaOS alone" lacks "$FAKE_DOCKER/calls.log" "systemctl restart casaos"
core_root 2
rm "$r/state/core/casaos.original"
core_setup
check "without the original, Atrio's core keeps running" cmp -s "$r/usr/bin/casaos" "$r/ours"
check "and the folder stays" test -d "$r/state/core"
core_root 3
echo "casaos v0.4.16" > "$r/usr/bin/casaos"
core_setup
check "another CasaOS is never touched" has "$r/usr/bin/casaos" "v0.4.16"
check "while the leftovers go" test ! -e "$r/state/core"
unset ATRIO_OLD_CORES ATRIO_OFFICIAL_CORES
rm "$SB/server/atrio-backup"
ATRIO_ROOT="$SB/root3" bash "$SCRIPTS/atrio-setup" "$SB/server" >/dev/null 2>&1
check "atrio-setup refuses a folder with a service missing" test ! -e "$SB/root3/usr/local/bin/atrio-update"
finish
