# Contributing to Atrio

Thanks for wanting to help. Atrio is a small project: bug reports from real servers are the most useful thing you can
give it, followed by ideas and code.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a bug

Open an [issue](https://github.com/peppeaiello/atrio/issues/new/choose) with the **Bug report** template and include:

- the Atrio version (Settings → Updates → Atrio) and the CasaOS version (same place);
- your browser and device (for example Firefox on Windows, Safari on an iPhone);
- what you did, what you expected, and what happened instead;
- a screenshot if it is about something you see, and any error from the browser console (`F12` → Console).

Before posting screenshots or logs, hide what you would not put on a public page: host names, domains, IP addresses,
user names, tokens and passwords.

If CasaOS itself misbehaves (an app does not start, a disk is not mounted), check whether the original CasaOS UI does
the same: Atrio only replaces the interface, so those problems usually belong to
[CasaOS](https://github.com/IceWhaleTech/CasaOS/issues).

## Suggesting an idea

Open an issue with the **Idea** template. Say what you are trying to do and why the current screens make it hard;
a sketch or a screenshot of another app that does it well helps a lot. The [roadmap](docs/ROADMAP.md) shows what is
already planned.

## Contributing code

1. Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) to run Atrio against your CasaOS server and build it.
2. For anything larger than a small fix, open an issue first so we can agree on the approach.
3. Fork [peppeaiello/atrio](https://github.com/peppeaiello/atrio), work on a branch and open a pull request against
   its `main` branch.

Please keep in mind:

- **Match the code around you**: naming, comment style, formatting. New screens use the Calm glass look (see
  `src/assets/scss/atrio/` and the existing panels) and Vue 3 components with `compatConfig: { MODE: 3 }`.
- **Accessibility matters**: buttons are real buttons with labels, status never relies on colour alone, panels can be
  closed with Esc and keep the keyboard focus inside while open.
- **Text is translatable**: wrap new strings in `$t()` and add them to `src/assets/lang/en_US.json`. Adding the
  Italian text to `it_IT.json` is welcome; other languages can follow later.
- **Describe changes for users** in a new entry at the top of [CHANGELOG.md](CHANGELOG.md) when they are visible.
- **Code, commits and documentation are in English.**
- **Do not touch the CasaOS backend**: Atrio only uses the APIs CasaOS already offers.

Check that `pnpm build` passes before opening the pull request, and describe how you tested your change.

## Translations

Atrio inherits many languages from CasaOS-UI, but the new screens are only in English and Italian. To translate them,
copy the keys missing from your language file in `src/assets/lang/` from `en_US.json` and translate the values;
keep the `{placeholders}` as they are.

## License

Atrio is released under the [Apache License 2.0](LICENSE). By contributing you agree that your contributions are
released under the same license.
