# Atrio roadmap

Where Atrio is going after 0.1, in the order we plan to work. The file manager (`src/components/files/`) is done
and stays as it is; the work below covers everything around it. See [VISION.md](VISION.md) for the look.

## 0.2 — Solid ground

Make what exists reliable before redesigning more.

- Fix the bugs found by the code audit of October 2026 (dashboard, app install and settings, settings menu,
  terminal and logs, updater).
- Try every app action live on a test app: install from the App Store, custom install, edit settings, restart,
  stop, start, update, uninstall.
- Check the first-run flow (welcome, account creation) and login on a fresh CasaOS.
- Check that a CasaOS update does not leave a broken UI, and have the installer bring Atrio back.

## 0.3 — Apps, the Atrio way

Docker management is what people use most, so it gets the next redesign.

- App details panel becomes the single place for an app: overview, logs, terminal and settings as tabs.
- New install and settings screens in the Calm glass style: fewer fields at once, clear sections
  (image, network and ports, storage, environment, advanced), helpful defaults and validation messages.
- App Store restyled: search first, categories, clear "installed" state, install progress in the app card.
- Bulk actions from the app list (restart or update several apps).

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
