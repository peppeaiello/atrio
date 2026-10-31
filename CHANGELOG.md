# Changelog

What changes in each Atrio release. The section for a version is also the text of its GitHub release.

## 0.1.6 — unreleased

**New**

- **Update screen.** While Atrio updates itself, a full-page screen shows each step (download, install,
  restart of CasaOS, reload) and stays until the page reloads into the new version. If the update fails it
  says why, and Atrio keeps working as before. You will see it from the update after this one.
- The settings icon shows a red dot when a new Atrio version is available, not only for CasaOS updates.
  Atrio checks again every 6 hours on a page left open.

## 0.1.5 — 2026-10-31

**New**

- **Hardware panel.** Click the health chip next to the greeting, or the chip icon in the System Status
  widget, to see the machine, BIOS, operating system, kernel, uptime, processor (model, cores, live
  frequency, load), memory and swap, and every sensor the machine reports, grouped by device. Fans,
  voltages and power show up on machines whose sensors expose them. Nothing to install on the server.
- The health chip also warns when the processor runs at 85 °C or more.
- **App panel tabs.** Overview, Logs (1000 lines, filter, follow, download) and Configuration (image,
  network, restart policy, published ports, mapped folders and environment variable names; values stay
  hidden).
- Installing a custom app: the tag defaults to `latest`, `nginx:1.27` typed in the image field fills the
  tag field, and registry ports (`registry:5000/app`) are no longer read as a tag.

**Fixed**

- The app menu (⋮) closed as soon as the mouse moved towards it.
- The terminal icon in the header sat lower than the other icons; the version line at the bottom left and
  the sidebar cards are aligned again.
- More room between the side column and the apps.
- After an update, browsers could keep showing the previous version until a hard reload: the updater
  now restarts the CasaOS gateway. Run `install.sh` again once to get the new updater.

## 0.1.4 — 2026-10-31

**New**

- **Atrio comes back after CasaOS updates.** When a CasaOS update puts its own UI back, Atrio reinstalls
  itself about 30 seconds later, from a local copy if GitHub cannot be reached. Installs from before
  0.1.4 need `install.sh` run again once.
- The welcome screen says "Welcome to Atrio".

**Fixed**

- App panel: stop and start show up right away, the terminal opens in front of the panel, broken app
  icons fall back to the default one.
- First run: the finish step moves on even if its animation never ends; a failed automatic login after
  creating the account no longer stops the setup.
- Many smaller fixes from a code audit: no crash when the server is unreachable, the avatar can be changed
  twice in a row, app store sources that are refused say why, keyboard focus stays inside the palette and
  the app panel.

## 0.1.3 — 2026-10-30

**Fixed**

- **Safer updates.** The new version is prepared next to the running one and swapped in at the end, with a
  rollback if anything fails, so an update never leaves a broken page. `custom.js` and `custom.css`
  survive updates.
- Saving app settings could be blocked because image, tag and name looked empty.
- The wallpaper, app tips and storage dialogs opened empty.
- Ports written as `3000` in a compose file, and empty or numeric environment values, broke the app form.
- Touch screens scroll the app grid; press and hold an app to move it.
- The bottom-left line shows the version and the CasaOS-UI credit.

## 0.1.2 — 2026-10-30

**Fixed**

- After an update the browser could keep the old page from its cache: Atrio now reloads a fresh copy.

## 0.1.1 — 2026-10-30

**Fixed**

- After an update Atrio checks its own version against the server and reloads once if they differ.

## 0.1.0 — 2026-10-30

First release.

- The "Calm glass" dashboard: greeting, status chips, app grid and widgets restyled.
- A new file manager.
- Runs on Vue 3 and builds with Vite.
- Install, update from the settings, and uninstall on any CasaOS with one command each.
