#!/bin/bash
# Runs every test of the services on the server (scripts/atrio-*), each in its own sandbox with a
# fake docker: nothing on this machine is touched and no root is needed.
#   pnpm test:server        or        bash tests/server/run.sh [backup schedule ...]
cd "$(dirname "$0")" || exit 1
for tool in python3 openssl gpg gpgv flock tar; do
	command -v "$tool" >/dev/null || { echo "Missing $tool, needed by the tests" >&2; exit 1; }
done
files=("$@")
[ "${#files[@]}" -gt 0 ] || files=(backup schedule folders updates autoupdate images compose settings updater repair alerts health disks selftest quiet history network tailscale)
failed=0
for name in "${files[@]}"; do
	bash "./$name.sh" || failed=1
done
[ "$failed" -eq 0 ] && echo "All tests passed" || echo "Some tests failed"
exit "$failed"
