# Changelog

What changes in each Atrio release. The section for a version is also the text of its GitHub release.

## 0.1.18 — unreleased

**New**

- **Settings file**, to move to a new machine: Settings → Settings file saves the dashboard, the push alerts, the
  backup folder and automatic backups, and the backup key in one file, encrypted on the server with a password you
  choose. Loading it on a new install puts them back; a server that already has another backup key asks before
  replacing it and keeps the old one. The README has a short guide to moving.
- **Unused app images**, in Settings → Storage: CasaOS keeps the old image after every app update and after an
  uninstall, and they add up (on our test server, 16 images and about 18 GB, mostly old Immich versions). Atrio lists
  the images that no container, running or stopped, and no installed app uses, with their size and date, and removes
  them one by one or all together, showing the space freed. Nothing is removed on its own.
- **Update available for apps on "latest" too.** CasaOS only offers an update when the App Store moves an app to
  another tag, so apps on `latest`, or on a tag like `3` that keeps getting new builds, never showed one. Every 6
  hours the server now asks each registry (Docker Hub, GitHub, linuxserver and others) which image the app's tag
  points at, and the tile shows Update available when it is newer than the one running. Update now saves a backup,
  downloads the new image of the same tag, recreates the app and checks that it stays up, offering the backup if it
  does not. The tag never changes, and nothing updates on its own. Apps pinned to a digest, and images built on the
  server, are left out.
- **Ignore updates** in an app's menu turns its Update available badge off, for an app you keep on its version on
  purpose. It can still be updated from the same menu, and Show updates again brings the badge back.
- **Activity**, in Settings → System and in the command palette: what happened on the server, newest first and by
  day. Apps installed, removed and updated (also outside Atrio), backups by hand, automatic and before updates,
  restores, backup folder and schedule changes, image cleanups, settings files and Atrio's own updates, with the
  reason when something failed. The services on the server write it, so it is there even when nobody had Atrio open.
- While an app updates, its tile shows each step on its ring (backup, download, start, check) instead of the menu
  staying open with a loading animation.

**Fixed**

- The install command run with ATRIO_SOURCE, to try the services of a checkout, kept the services of the release
  instead.

## 0.1.17 — 2026-11-13

**Run the install command one last time** after updating to this version: from now on, updating Atrio from the
settings also updates the services on the server (updater, push alerts, backups), so new versions no longer ask for
it.

**New**

- **Automatic backups.** In the Backup tab of an app, choose every day or every week, the time, and how many
  automatic backups to keep (1 to 30). They save the folders ticked in the tab and stop the app while they run, like
  a backup made by hand, and the oldest automatic ones are deleted; backups made by hand stay. A server that was off
  at that time makes the backup once it is back on. The tab shows the last automatic backup, and a push alert says
  when one fails.
- **Updating from the settings updates the services on the server too.** Each release now carries them in a signed
  bundle, checked with the same key as the web UI before anything is installed.
- **Edit text files in Files**, as in the classic CasaOS panel: Edit in the preview of a text or code file, such as
  an app's docker-compose.yml, then Save. The preview is now a code editor with line numbers, syntax colours for
  about thirty languages, folding, bracket matching, undo and redo, and a search bar with replace. YAML and JSON are
  checked as you type: an error is marked on its line, and saving a file with an error asks first. It works on a
  phone too. Leaving with unsaved changes asks first, and if something else changed the file after it was opened,
  saving asks before replacing that version. Files over 512 KB stay read only.

**Fixed**

- **The install command shows what it is doing**: a line for each step and a progress bar while it downloads Atrio,
  instead of a long silence between the first and the last line.
- Clicking the Atrio row in the settings no longer turns it white.
- A backup started from the Backup tab while another one runs on the server waits for it, and says so, instead of
  failing after 30 seconds.

## 0.1.16 — 2026-11-11

**New**

- **Share folders on your network from Files** (#9), as in the classic CasaOS panel: Share in a folder's menu
  makes it a guest Samba share and shows the address to open it from Windows, a Mac or Linux. Shared folders
  are marked as such and listed under Shared at the bottom of the sidebar, where sharing can be stopped.

**Fixed**

- Hovering an app no longer draws a dark shadow around its tile.
- When the push service refuses an alert, the status shows its own answer, such as the reason Apprise gives, instead
  of only "error 400". Run the install command once more to get it.

## 0.1.15 — 2026-11-07

**New**

- **Push alerts through Apprise**, next to ntfy and Gotify: give the address of your Apprise API server and the key
  of a saved configuration, and the alerts reach every service in it, such as Discord, Telegram or e-mail. The
  service on the server learns it when the install command is run once more.
- Settings → Dashboard → "Terminal icon opens" chooses whether the terminal icon in the top bar opens the logs or
  goes straight to the terminal.
- **Backups are encrypted.** A backup holds the app's data and its passwords, and can sit on a share or a cloud
  drive: it is now encrypted with a key that stays on the server. The Backup tab shows the key, to keep a copy for a
  new machine. Backups made before stay as they are.

**Fixed**

- **Backups are signed, and a restore checks the archive before using it.** A backup folder on a network share, a
  USB drive or a cloud drive can be written by others, and a changed backup could put files outside the app's
  folders when restored as root. Each new backup now carries a signature made with a key that stays on the server,
  and a backup changed after it was made, or with files outside the app's folders, is refused. Backups made with
  0.1.14 can still be restored from the default backup folder. Run the install command once more to get it.
- The settings of push alerts, with the token of the push service, could be read by every user of the server. Only
  root can read them now.
- **Releases are signed** with a key that stays on the maintainer's machine, and Atrio installs an update only if
  its signature matches. Even someone with access to the GitHub account cannot push an update to your server. This
  starts with the next update after this one, once the install command has been run again.
- The install command took the services on the server from the code in progress on GitHub, which could be ahead of
  the release it installs. It now takes them from the latest release.
- On phones the widgets panel covered the top bar, so the only way out was reloading the page. It now opens below
  the top bar, whose button closes it, and the greeting and apps no longer show or react behind it.
- The menu of an app near the bottom of the screen was cut off. It now opens above the button when there is no room
  below, and to the left near the right edge.

## 0.1.14 — 2026-11-05

**New**

- **Backups for each app**, in a new Backup tab of the app panel: its settings and the folders you choose, with their
  size, to a folder you pick. Going back takes one click, and saves the current state first so that it can be
  undone too. Large folders and folders outside the app's own data are left out unless you choose them. Needs the
  small service added by running the install command once more.
- **Backups can go to another disk, a USB drive, a network folder or a cloud drive**: pick any location connected in
  Files, such as Google Drive, Dropbox, OneDrive or an SMB share. If it is not connected at that moment, the backup
  stops and says so instead of filling the main disk. For network and cloud locations the app restarts first and the
  backup is sent afterwards, then read back to check it. Backups are not encrypted yet. The list of an app keeps the
  backups in every folder used so far, with date and time; those on a disk that is not connected show as unavailable.
  Tried on a USB drive so far: network and cloud locations should work the same way, but have only been tested with a
  local stand-in, so check your first backup there.
- **Safer app updates.** When the service is there, an update saves a backup first, keeping the last 3 made this way.
  If the app does not come back up while Atrio is open, it offers to go back to that backup.
- **A push alert when an app has been updated**, so you can start an update and leave the page (#6). It comes within
  5 minutes of the app running its new version, and has its own switch in Settings → Push notifications. Existing
  installs get it by running the install command once more.

**Fixed**

- **Updating an app could take it back to an older version.** The App Store pins each app to one version, and
  CasaOS offers it as an update whenever the installed tag differs, even when it is older or the app runs
  `latest`. An older image can refuse the data of a newer one and stop starting. Atrio now checks the direction:
  no Update available label in that case, and Update, also from the details panel and for several apps at once,
  leaves the app as it is and says why.
- Update on an app that announces a new version the App Store does not have yet seemed to do nothing. It now says the
  app is already on the version the App Store offers.
- A card saying "Installing" with a progress bar at 0 could stay on the dashboard after updating an app, until the
  page was reloaded. Updates show their progress only on the app's tile.

## 0.1.13 — 2026-11-02

**New**

- **Wider layout.** Settings → Dashboard → Width is a slider: on large screens the top bar and the dashboard grow
  from the usual width up to most of the window. The widget column gets wider and the app grid fits more apps per
  row instead of larger tiles.
- The greeting has a switch to show or hide it and a size slider, from small to larger than before. Double click
  a slider to reset it.

## 0.1.12 — 2026-11-01

**New**

- **Update progress.** While an app updates, its tile shows the download of the new version with the same
  progress ring as installs, then a spinning arc and "Updating" while it restarts (#3).
- The Hardware panel shows how busy the processor is, in total and for each core, next to the memory bar.

**Fixed**

- Apps whose image is pinned to an exact build (`name:tag@sha256:…`, as Immich and Nginx do) showed the long
  hash as their tag in the settings form. The form now shows the real tag, and the details panel shows only
  the start of the hash.
- On CasaOS forks that only send live data to a signed-in user, such as ReCasaOS, the dashboard stayed frozen:
  graphs, install progress and notifications now arrive there too.

## 0.1.11 — 2026-11-01

**New**

- **Add storage from the file manager**, as in the classic CasaOS panel: a + next to Storage connects a
  network folder (SMB, with a name and password or as a guest), Google Drive, Dropbox or OneDrive, or opens
  the storage manager for a local disk. Network folders, cloud drives and USB disks get a button to
  disconnect or eject them.
- The greeting above the dashboard can be large, small or hidden (Settings → Dashboard → Greeting); the status
  chips stay either way.

**Fixed**

- A failed app update no longer causes an error in the app grid.

## 0.1.10 — 2026-11-01

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
