<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/img/logo/atrio-wordmark-light.svg">
    <img alt="Atrio" src="src/assets/img/logo/atrio-wordmark-dark.svg" height="64">
  </picture>
</p>

<p align="center">A modern, redesigned web UI for <a href="https://casaos.zimaspace.com">CasaOS</a>.</p>

---

The atrium is the room you walk through when you enter a home. Atrio wants to be that for your home server: the first
thing you see, clean and quick to get around.

Atrio is a fork of [CasaOS-UI](https://github.com/IceWhaleTech/CasaOS-UI) by [IceWhale Technology](https://github.com/IceWhaleTech).
It talks to the standard CasaOS backend, so it replaces only the web interface: your apps, settings and data stay
the same.

> **Status:** early days. The home page is redesigned (glass look, live widgets, command palette, app details
> panel); the other screens still look like CasaOS.

Atrio is an independent project, not affiliated with or endorsed by IceWhale Technology. CasaOS is a trademark of
its respective owners.

## Compatibility

Tested with CasaOS **v0.4.15**.

## Install

On the machine that runs CasaOS:

```shell
curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
```

Then reload CasaOS in your browser with `Ctrl+F5`. The script:

- saves a copy of the original CasaOS UI in `/var/lib/casaos/atrio/casaos-ui-original`;
- installs the latest [release](https://github.com/peppeaiello/atrio/releases) in `/var/lib/casaos/www`, the folder
  CasaOS serves its UI from;
- installs a small updater (`/usr/local/bin/atrio-update` and the `atrio-update.path` systemd unit);
- watches the UI folder (`atrio-restore.path`) so Atrio comes back on its own after a CasaOS update.

Nothing else changes: CasaOS, your apps and their data are left as they are.

## Update

Open the settings menu (the sliders icon at the top): the **Atrio** row shows your version and, when a new release is
out, an **Update** button. Atrio asks the updater on the server to download the release from GitHub, checks its
checksum and installs it, then reloads the page.

From a terminal you can do the same with `sudo atrio-update`.

Updating CasaOS puts its own UI back. About half a minute later the updater notices it, saves that newer CasaOS UI
as the copy used by the uninstaller, and installs Atrio again (from the last release it kept, if GitHub cannot be
reached). Installs made before Atrio 0.1.4 lack this: run the install command once more to add it.

## Uninstall

```shell
curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/uninstall.sh | sudo bash
```

It puts the original CasaOS UI back and removes the updater. Reload the page with `Ctrl+F5`.

## Development

### Prerequisites

- Node.js 22 LTS
- pnpm 9

### Run against your CasaOS server

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

### Build

```shell
pnpm install
pnpm build
```

The build goes to `build/sysroot/var/lib/casaos/www/`, which is the folder CasaOS serves its UI from.

### Release

1. Set the new version in `package.json` (for example `0.2.0`) and commit it.
2. Tag the commit and push the tag:

```shell
git tag v0.2.0
git push origin v0.2.0
```

The [Release workflow](.github/workflows/release.yml) builds Atrio and publishes `atrio.tar.gz` with its checksum.
Installed copies see the new version in their settings.

## Credits

Atrio builds on the work of the IceWhale team and the CasaOS community: thank you for making CasaOS and releasing
it as open source. The full commit history of CasaOS-UI is preserved in this repository.

## License

[Apache License 2.0](LICENSE), same as the original project. See [NOTICE](NOTICE) for attribution.
