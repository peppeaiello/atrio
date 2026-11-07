# Developing Atrio

## Prerequisites

- Node.js 22 LTS
- pnpm 9

## Run against your CasaOS server

1. Copy `.env.dev` to `.env.dev.local` (git-ignored).
2. Set `VUE_APP_DEV_IP` to the address of your CasaOS server (`127.0.0.1` if you develop on the server itself).
3. Start the dev server:

```shell
pnpm install
pnpm dev
```

The dev server is [Vite](https://vite.dev) on http://localhost:8080 (`pnpm dev --port <n>` to change it). API calls to
`/v1` and `/v2`, WebSockets included, are proxied to your CasaOS server, so you can use the dev UI with your real
account.

## Build

```shell
pnpm install
pnpm build
```

The build goes to `build/sysroot/var/lib/casaos/www/`, which is the folder CasaOS serves its UI from.

## Release

1. Add a section for the new version at the top of [CHANGELOG.md](CHANGELOG.md) (`## 0.2.0 — date`), with
   what changed for people using Atrio, and set the version in `package.json`. Commit both.
2. Tag the commit and publish it from the maintainer's machine:

```shell
git tag v0.2.0
scripts/release.sh v0.2.0
git push origin main
```

`scripts/release.sh` builds Atrio, signs `atrio.tar.gz` with the release key, which never leaves that machine,
pushes the tag and uploads the archive, its checksum and its signature to a new GitHub release. Installed copies
check the signature against `scripts/atrio-release-key.gpg` and refuse a release that key did not sign, so nothing
published through the GitHub account alone reaches them. The changelog section becomes the text of the release.
Edits to CHANGELOG.md pushed to `main` later update the published releases too
([Release notes workflow](.github/workflows/release-notes.yml)).
Installed copies see the new version in their settings.
