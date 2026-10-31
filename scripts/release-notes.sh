#!/usr/bin/env bash
# Prints the GitHub release text for a tag: its section of CHANGELOG.md and a link to the full diff.
#   scripts/release-notes.sh v0.1.5
set -euo pipefail

tag="$1"
version="${tag#v}"
repo="${GITHUB_REPOSITORY:-peppeaiello/atrio}"
changelog="$(dirname "$0")/../CHANGELOG.md"

# The lines after "## <version>" up to the next "## " heading, without leading and trailing blank lines
section=$(awk -v v="$version" '
	/^## / { if (found) exit; found = ($2 == v); next }
	found' "$changelog" | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}' |
	# GitHub turns every newline of a release into a line break: join the wrapped lines of list items
	awk '/^  [^ ]/ && prev != "" { prev = prev " " substr($0, 3); next } { if (NR > 1) print prev; prev = $0 } END { print prev }')

# The version listed right below this one, for the compare link
previous=$(awk -v v="$version" '/^## / { if (seen) { print $2; exit } if ($2 == v) seen = 1 }' "$changelog")

if [ -n "$section" ]; then
	printf '%s\n\n' "$section"
fi
if [ -n "$previous" ]; then
	printf '**Full changelog**: https://github.com/%s/compare/v%s...%s\n' "$repo" "$previous" "$tag"
fi
