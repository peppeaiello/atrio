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

> **Status:** early days. Right now Atrio is CasaOS-UI with a new identity; the redesign is in progress.

Atrio is an independent project, not affiliated with or endorsed by IceWhale Technology. CasaOS is a trademark of
its respective owners.

## Compatibility

Tested with CasaOS **v0.4.15**.

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

API calls to `/v1` and `/v2` are proxied to your CasaOS server, so you can use the dev UI with your real account.

### Build

```shell
pnpm install
pnpm build
```

The build goes to `build/sysroot/var/lib/casaos/www/`, which is the folder CasaOS serves its UI from.

### Test

```shell
pnpm test
```

## Credits

Atrio builds on the work of the IceWhale team and the CasaOS community: thank you for making CasaOS and releasing
it as open source. The full commit history of CasaOS-UI is preserved in this repository.

## License

[Apache License 2.0](LICENSE), same as the original project. See [NOTICE](NOTICE) for attribution.
