#!/usr/bin/env bash
# Publishes an Atrio release from the maintainer's machine:
#   scripts/release.sh v0.1.15
# It builds Atrio, signs atrio.tar.gz with the release key that stays on this machine, pushes the
# tag and uploads the release to GitHub. Installed copies only install what this key signed
# (scripts/atrio-update), so a release uploaded by anyone else, even through the GitHub account,
# is refused. Push main after it.
#
# Needs, outside the repository:
#   ~/.config/atrio/gnupg         the signing key (scripts/atrio-release-key.gpg is its public half)
#   ~/.config/atrio/github-token  a fine-grained token for this repository only, Contents: read and write
set -euo pipefail

tag="${1:-}"
repo="peppeaiello/atrio"
export GNUPGHOME="${ATRIO_GNUPGHOME:-$HOME/.config/atrio/gnupg}"
token_file="${ATRIO_GITHUB_TOKEN_FILE:-$HOME/.config/atrio/github-token}"
cd "$(dirname "$0")/.."

die() { echo "$1" >&2; exit 1; }

[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || die "Usage: scripts/release.sh vX.Y.Z"
[ "v$(node -p "require('./package.json').version")" = "$tag" ] || die "$tag does not match the version in package.json"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "Commit or stash the changes first"
[ "$(git rev-parse "$tag^{commit}" 2>/dev/null)" = "$(git rev-parse HEAD)" ] || die "Tag $tag must exist and point at HEAD"
[ -s "$token_file" ] || die "Missing GitHub token in $token_file"
[ "$(stat -c %a "$token_file")" = 600 ] || die "$token_file must be readable by you only (chmod 600)"
gpg --list-secret-keys "Atrio release signing" >/dev/null 2>&1 || die "The release signing key is not in $GNUPGHOME"

out=build/release
rm -rf "$out"
pnpm build
mkdir -p "$out"
tar -czf "$out/atrio.tar.gz" -C build/sysroot/var/lib/casaos/www .
(cd "$out" && sha256sum atrio.tar.gz > atrio.tar.gz.sha256)
gpg --batch --yes --local-user "Atrio release signing" --detach-sign -o "$out/atrio.tar.gz.sig" "$out/atrio.tar.gz"
gpgv --keyring "$PWD/scripts/atrio-release-key.gpg" "$out/atrio.tar.gz.sig" "$out/atrio.tar.gz" 2>/dev/null \
	|| die "The signature does not match scripts/atrio-release-key.gpg"
scripts/release-notes.sh "$tag" > "$out/notes.md"

# The token never goes on a command line, where other users of this machine could see it
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT
chmod 600 "$headers"
printf 'Authorization: Bearer %s\nAccept: application/vnd.github+json\nX-GitHub-Api-Version: 2022-11-28\n' \
	"$(tr -d '\r\n' < "$token_file")" > "$headers"
api() { curl -fsS -H @"$headers" "$@"; }

git push origin "$tag"

prerelease=false
[[ "$tag" == *-* ]] && prerelease=true
# A draft first: installed copies only see the release once every file is there
release=$(python3 -c 'import json, sys; print(json.dumps({"tag_name": sys.argv[1], "name": sys.argv[1], "body": open(sys.argv[2]).read(), "draft": True, "prerelease": sys.argv[3] == "true"}))' \
	"$tag" "$out/notes.md" "$prerelease" | api -X POST "https://api.github.com/repos/$repo/releases" --data-binary @-)
id=$(printf '%s' "$release" | python3 -c 'import json, sys; print(json.load(sys.stdin)["id"])')

for file in atrio.tar.gz atrio.tar.gz.sha256 atrio.tar.gz.sig; do
	api -X POST -H 'Content-Type: application/octet-stream' --data-binary @"$out/$file" \
		"https://uploads.github.com/repos/$repo/releases/$id/assets?name=$file" >/dev/null
done

api -X PATCH "https://api.github.com/repos/$repo/releases/$id" --data-binary '{"draft": false}' >/dev/null
echo "Released $tag: https://github.com/$repo/releases/tag/$tag"
echo "Now push main: git push origin main"
