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

1. Set the new version in `package.json` (for example `0.2.0`) and commit it.
2. Tag the commit and push the tag:

```shell
git tag v0.2.0
git push origin v0.2.0
```

The [Release workflow](../.github/workflows/release.yml) builds Atrio and publishes `atrio.tar.gz` with its checksum.
Installed copies see the new version in their settings.
