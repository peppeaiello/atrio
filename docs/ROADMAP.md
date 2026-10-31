# Atrio roadmap

Where Atrio is going after 0.1, in the order we plan to work. The file manager (`src/components/files/`) is done
and stays as it is; the work below covers everything around it. See [VISION.md](VISION.md) for the look.

## 0.2 — Solid ground

Make what exists reliable before redesigning more.

- [x] Fix the bugs found by the code audit of October 2026 (dashboard, app install and settings, settings menu,
  terminal and logs, updater).
- [x] Try every app action live on a test app: install from the App Store, custom install, edit settings, restart,
  stop, start, update, uninstall.
- [x] Check the first-run flow (welcome, account creation) and login on a fresh CasaOS.
- [x] Check that a CasaOS update does not leave a broken UI, and have the installer bring Atrio back.

## 0.3 — Apps, the Atrio way

Docker management is what people use most, so it gets the next redesign.

- App details panel becomes the single place for an app: overview, logs, terminal and settings as tabs.
  First step done: Overview, Logs (filter, follow, download) and a read-only Configuration tab.
- New install and settings screens in the Calm glass style: fewer fields at once, clear sections
  (image, network and ports, storage, environment, advanced), helpful defaults and validation messages.
  First step done: the tag defaults to "latest" and "name:tag" typed in the image field is split.
- App Store restyled: search first, categories, clear "installed" state, install progress in the app card.
  First step done: search first, category and author chips, featured row, clear installed / installing /
  not available states, details in the same style, and install progress as a card in the home grid.
- Bulk actions from the app list (restart or update several apps).
- [x] Atrio updates: red dot on the settings icon when a version is available, full-page progress screen
  while it installs.
- [x] Hardware panel, opened from the health chip or the System Status widget: machine, BIOS, operating
  system, processor, memory and every hwmon sensor (temperatures, and fans, voltages and power where the
  machine reports them), read from /proc and /sys with no server component. Disk SMART data needs root
  and comes later.

## 0.4 — Settings, account, terminal and logs

- Settings move from the dropdown to a full panel with sections (appearance, search, network, storage, updates,
  system), including the Atrio updater.
- Account panel: profile picture, password, sessions, in the new style.
- Terminal and logs: a single console with tabs for the host and each app, follow mode, search in logs, download.

## 0.5 — Home, round two

- Widgets that can be added, removed and reordered from the dashboard, plus first custom widgets
  (for example an app's own status page).
- Notifications centre (app updates, disk warnings, finished installs).
- Mobile pass: layout, touch targets, PWA install.

## Before the public announcement

- No screens left in the old CasaOS style among the ones above.
- README with screenshots or a short video.
- Own CONTRIBUTING and CODE_OF_CONDUCT (the current ones come from CasaOS-UI).
- A few weeks of private testing with friends running CasaOS, issues tracked on GitHub.
