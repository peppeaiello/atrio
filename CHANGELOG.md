# Changelog

What changes in each Atrio release. The section for a version is also the text of its GitHub release.

## 0.1.10 — unreleased

**New**

- **App tiles you can use everywhere.** The whole tile opens the app (a real link, so middle click and copy
  link work), the menu button is always reachable on phones and from the keyboard, and Tab now moves
  through the apps.
- A stopped app no longer starts when clicked: the tile offers Start and open, Start or Details.
- The app menu is in the glass style, with every action labelled: Open and Details first, Uninstall last.
- Quieter status: running apps get a small dot on their icon, and only exceptions get a label: Stopped, or
  Update available when a newer version is out. Labels stay readable on any wallpaper.
- Compact tiles (about twice as many apps on screen) and a search field for the app grid.
- **Push alerts to your phone**, even with Atrio closed, through [ntfy](https://ntfy.sh) (public or
  self-hosted) or Gotify: disk almost full, disk health problems, a hot processor, apps installed or
  removed, and new Atrio versions. Set them up in Settings → Push notifications, with a button to send a
  test. A small service on your own server checks every 5 minutes; nothing goes through anyone else's
  server. Existing installs get it by running the install command once more.

**Fixed**

- A built-in wallpaper saved by an older build could disappear after an update; it is now found again.
- On phones the icons of the top bar sat lower than the logo.
- On machines where CasaOS reports no disk size (for example in a Proxmox LXC container), the Storage widget
  showed an endless red animated bar. It now says the size is not reported (#2).

## 0.1.9 — 2026-10-31

**New**

- The remaining CasaOS dialogs use the glass look too: WebUI port, wallpaper, CasaOS update and its release
  notes, external links, the storage manager and disk merge, notes before an install, import, and the
  update-complete message.

**Fixed**

- Older notifications showed their date in the browser's language instead of Atrio's.

## 0.1.8 — 2026-10-31

**New**

- **Notification centre.** A bell in the top bar, with the number of new notifications, opens a list of
  what happened: apps installed, removed or updated, installs and settings that failed, a system disk
  almost full or reporting a health problem, a hot processor, and new Atrio or CasaOS versions. Each
  warning comes once while the problem lasts. Notifications are kept in this browser (the last 50).
- **Widgets your way.** "Widgets Settings" opens a panel where widgets can be shown, hidden and put in any
  order (drag them or use the arrows). The order is saved on the server.
- **Web page widget.** Add any page of your network to the widget column, for example an app's status page
  or a small dashboard, with a title and a height. You can add several, edit or remove them.
- **Better on phones.** The top bar fits in one row with larger tap areas, the app filters get their own
  row, the App Store header stays on one line, and the console shows its sources as a row of chips.
- **Install Atrio as an app.** On a phone or in Chrome, "Add to home screen" or "Install" opens Atrio full
  screen with its own icon (over HTTPS, as browsers require).

## 0.1.7 — 2026-10-31

**New**

- **Settings panel.** The settings icon opens a side panel in sections (Appearance, Web search, Dashboard,
  Network, Storage, Updates, System) instead of a long dropdown. It also opens from the command palette,
  and System has a shortcut to the Hardware panel next to Restart and Shut down.
- **Account panel.** The account icon opens a side panel with your picture (click it to change and crop
  it), name, password and Log out, in the same style. Changing the password now confirms it worked.
- **One console for terminal and logs.** The terminal icon opens a console with the server and every app
  on the left. For each one: logs with a filter, follow and download, and a terminal (an SSH sign-in for
  the server, the app's own shell for apps).

**Fixed**

- Actions on several apps only reach the selected apps the current filter shows, and the count says so.
- Esc in the App Store search clears it; pressed again on an empty search it closes the store.
- If the update check fails (GitHub down or rate limited), Atrio tries again after 5 minutes instead of 6 hours.
- The Terminal tab goes back to Overview when the app stops, and reconnects to the new container after an
  update.
- A failed install no longer leaves a card in the app grid once the app shows up in the list.
- On phones the App Store toolbar wraps instead of scrolling sideways when adding a source.
- Quick clicks on the App Store categories always show the apps of the last category chosen.

## 0.1.6 — 2026-10-31

**New**

- **Update screen.** While Atrio updates itself, a full-page screen shows each step (download, install,
  restart of CasaOS, reload) and stays until the page reloads into the new version. If the update fails it
  says why, and Atrio keeps working as before. You will see it from the update after this one.
- The settings icon shows a red dot when a new Atrio version is available, not only for CasaOS updates.
  Atrio checks again every 6 hours on a page left open.
- **New App Store look.** A large search field first (every word must match the name, tagline or
  category; Esc clears it), categories and authors as chips, a Featured row with arrows, and app cards
  that say clearly whether an app is installed (with Open), being installed, or not available for this
  machine. The app details opened from the store use the same style.
- **Install progress on the home screen.** An app being installed appears in the app grid right away, with
  a progress ring and the percentage, and becomes a normal app card when it is ready. If the install
  fails, the card says so (the reason is in its tooltip) until you dismiss it.
- **Install and settings screens in the new style.** The form is split into sections (App, Network and
  ports, Storage, Environment, Advanced) with a quick index on top; the advanced options start folded.
  The whole window, including the install progress, uses the same glass look as the dashboard.
- Form errors say what to type: an example image, a version, a valid port or range, the allowed characters
  of a container name, a port already in use. Port fields now show their message too.
- **Actions on several apps.** "Select" next to the app filters lets you tick apps and start, stop,
  restart or update them together. Apps that do not accept the action stay selected, so you can retry.
- **Terminal and Settings in the app panel.** The panel now has Overview, Logs, Terminal and Settings tabs:
  the terminal opens right there (Esc and Tab go to the shell), and Settings shows what the app runs with
  and an Edit settings button.

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
