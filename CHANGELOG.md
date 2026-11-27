# Changelog

What changes in each Atrio release. The section for a version is also the text of its GitHub release.

## Unreleased

**New**

- **Folder backups**: documents, photos or any other folder on the server can be backed up now, by hand or every day
  or week, keeping the last few automatic ones. Open them from Settings → System, from the command palette, or with
  "Back up this folder" on a folder in Files. Backups are encrypted and signed like those of apps, in the same backup
  folder, and a failed automatic one sends a push alert. A backup goes back either as a copy next to the folder, or
  in its place: then the folder as it was is kept next to it under another name, so nothing is lost and no extra
  space is needed. A folder on a disk that is not plugged in is never backed up as empty. The folders and their
  schedules are in the settings file too.
- **Compose file editor**: the install screen and the settings of an app have a Compose file view next to the form.
  Every setting of Docker Compose can be written there, also the ones the form does not have, and it is installed
  or saved exactly as written. It is checked as you type, with the problem underlined on its line: a missing image,
  a wrong or repeated port, a volume that is not a full path, and more. **From docker run** turns one or more
  `docker run` commands into services, and **Load a file** opens a compose file from your computer. The Import
  button opens this view, and replaces the old import window.
- **Supporting Atrio**: Atrio stays free, with no paid features, ads or telemetry. The README has a short Support
  section, every release ends with one line about Ko-fi, and the Atrio row in Settings says how to support it. After
  an update, once and only once in each browser, a small message at the bottom mentions Ko-fi; closed, it does not
  come back.
- **Custom greeting** (#16, by @YuuuHG): the greeting above the dashboard can be your own line, set in Settings →
  Dashboard, with `{name}` for the user name. Left empty, it still changes with the time of day.

## 0.1.31 — 2026-11-27

**New**

- **Simplified Chinese** (#15, by @YuuuHG): Atrio's own screens are now translated into Simplified Chinese too, not
  only the ones inherited from CasaOS.

**Fixed**

- **Updating apps with an image chosen by hand** (#13): when the image or tag of an app was changed in its settings
  (CasaOS calls it uncontrolled), the tile said "Update available" but the app details and the app menu had no
  update button; only selecting the app worked. The button is back, and for these apps Atrio only takes a newer image
  of the tag they use (`5.0.0-develop` stays `5.0.0-develop`), never the App Store's version, which would replace it.
  Ignoring updates and automatic updates are in their menu too.
- **Automatic updates after a failed rollback**: when a new image did not start and going back to the backup failed
  too, the next night tried the same image again. Now it waits for a newer one, as it already did after a rollback
  that worked.
- **Reinstalled apps**: an app uninstalled while it was set to update automatically, or to ignore updates, kept that
  setting, and an app installed later with the same name found it already on. Uninstalled apps now leave both lists.
- **Push alerts for apps with a dot in their name**: the memory of what was already sent could mix up two apps whose
  names differ only where one has a dot (`my.app` and `myxapp`), so an alert could be skipped or sent twice.

## 0.1.30 — 2026-11-25

**Fixed**

- **CasaOS left as it is**: 0.1.28, withdrawn a few minutes after its release, put Atrio's own build of the CasaOS
  v0.4.15 core in place of `/usr/bin/casaos` on the few servers that installed it then. Atrio replaces the web UI
  only, so on those servers this update puts IceWhale's original core back (CasaOS restarts once) and removes
  `atrio-core`. Other servers are not touched.

## 0.1.29 — 2026-11-25

0.1.28 was withdrawn a few minutes after its release, before any server installed it: this release has its changes.

**New**

- **Repeated lines in the CasaOS log**: CasaOS writes the same line about the CPU sensor every 5 minutes, which made up
  most of its log. In the console, a line repeated in a row now shows once, the latest one, with how many times and
  since when (`×22 since 13:59`). The line count and the download still have every line.

**Fixed**

- **App menu on phones**: on a narrow screen the menu of an app in the left column could open past the left edge,
  with half of its entries cut off. It now opens on the side with more room and always stays inside the screen; long
  entries wrap instead of widening it.
- **Dates in the CasaOS log**: the console cut the first 8 characters of every line of the CasaOS log, so each line
  started with `25T17:26:24` instead of `2026-11-25T17:26:24`. Lines now show their full date.

## 0.1.27 — 2026-11-24

**Fixed**

- **Servers without the Docker Compose plugin** (#11): every app backup, the list of unused images and the check for
  new images stopped at "Docker Compose is not available". CasaOS has compose built in and does not need it, so
  Docker installed from a distribution's packages often comes without it. Only restoring and updating an app, which
  recreate its containers, need it now; they use the older standalone `docker-compose` when that is there, and
  otherwise Atrio downloads the official Docker Compose binary (v5.6.1, about 33 MB) once into
  `/usr/local/lib/atrio`, checks it against the SHA-256 written in its own signed script before it is ever run, and
  uses that. The check for new versions every 6 hours fetches it ahead of time, so a restore works later also
  offline. When it cannot be downloaded (no internet, a full disk, a processor with no release), nothing is stopped
  or changed and the message says why. Uninstalling Atrio removes it.
- **Updating apps installed from outside the App Store** (#12), from linuxserver, ghcr.io and the like: since the
  check for a newer image failed on those servers, Atrio fell back on the CasaOS App Store, which may have an old app
  of the same name or none at all, and said things like "the App Store only offers an older version". Now an app with
  no newer image is simply up to date, a failed check says why, and an app the App Store does not know is never
  described by it.

## 0.1.26 — 2026-11-21

**New**

- **Automatic updates per app**, from the app's menu: **Update automatically**. Each night at 4:00 the server checks
  the chosen apps and updates those with a newer image of the version they use (an app on `latest`, or on a tag like
  `3`), the same way an update by hand does it: a backup first, the new image, and back to that backup if the app
  does not come up. A new version from the App Store, with another tag, is never taken on its own, because it may
  need a look first. A server that was off at 4:00 catches up when it is back, until 8:00. A new image that did not
  start is not tried again; a newer one is. Each automatic update is in Activity, and one that fails sends a push
  alert. Ignoring an app's updates turns its automatic updates off.

**Fixed**

- Shutting down said the server was off as soon as Atrio stopped answering, while Docker could still be stopping
  the apps. It now waits until the server has been silent for 90 seconds before saying the power can be cut.
- In the Tailscale panel, a click during a status check could fail with "Another backup is in progress".
- Automatic backups set between 2:00 and 2:59 failed on the day summer time starts.
- A disk whose health got worse during a self-test started from the panel never sent its push alert.
- Uninstalling kept the backup key but deleted the keys replaced by a settings file, which read the older backups.
- Activity showed a failed update of the services on the server as installed.
- Some messages from the server were not translated.

## 0.1.25 — 2026-11-19

**New**

- **Remote access with Tailscale**, from Settings → Network → Remote access, or by typing "remote" in the command
  palette. If Tailscale is not on the server, Atrio installs it with Tailscale's own installer. Signing in gives a
  link and a QR code, to open on this computer or on the phone, and the page goes on by itself once you are in. Once
  connected it shows the address that opens Atrio from anywhere, with a QR code for the phone, this server's name and
  addresses, the other devices of the tailnet and whether they are online, and anything Tailscale warns about. It
  can be turned off and on, or signed out. Turning it off and on goes through its daemon's local API, so routes,
  exit node and SSH set with the `tailscale` command stay as they are; signing out clears them, as Tailscale does.
  Installs, sign-ins and changes are listed in Activity.

**Fixed**

- The tabs of an app's panel (Overview, Logs, Terminal, Settings, Backup) shrank to a thin line when a tab was long,
  such as Backup with several saved backups, and could not be clicked.
- In the network detail an app could show more than 100% of the traffic: traffic between apps on the server never
  reaches its network card, so when the apps add up to more than the server's total, their sum is now the whole bar.
- A disk's last self-test said "1 days ago" the day after: it now says "yesterday".

## 0.1.24 — 2026-11-17

**New**

- **The services on the server update themselves, with no command to run, on every install.** Installs made
  before 0.1.17 only ever updated the web UI, so their backups, push alerts and checks stayed old unless someone ran
  the install command again. Now each release carries its updater and public key inside the web UI, and when Atrio
  sees that the services on the server are behind, it puts that updater in place of the old one through CasaOS and
  asks for an update: the services are brought up to date and, on installs that had none, the release key is
  adopted, so every later release must be signed with it. It stays on for good, so whatever leaves the services
  behind (an old install, an update cut short) is put right the next time Atrio is opened. The install command is
  only shown when this cannot work on that server.
- **Safer updates**, after a study of how Pi-hole, Netdata, Home Assistant, Umbrel and others update themselves:
  the web UI and the services come from the same release, looked up once; the services carry their version, signed,
  and the services of another release are refused; a setup of the services that fails half way puts the previous
  ones back; after a CasaOS update, Atrio never comes back as a release older than one installed before; and the
  updater is read whole before it runs, so it can be replaced safely while it works.

**Changed**

- **Restart and shut down** show a full-page screen in the style of the Atrio update, in place of CasaOS's small
  white box with its message cut off: the steps (the server stops, starts again, Atrio comes back), the time
  passed, and a page that reloads by itself as soon as the server answers again, instead of checking every 30
  seconds. After a shutdown it says when the power can be cut, once the server no longer answers.

**Fixed**

- **Disks in the hardware panel** (#10): a disk that was unplugged stayed in the list for good; it goes away at the
  next hourly check now. And one old cable error kept a disk on "Keep an eye on it" forever, since that counter
  never goes back to zero: only cable errors that came in the last week count now, while the number stays shown.
- **App settings and install:** a port range like 8000-8010 was cut to its last port, or to its first in the
  Container field, and ports such as 0 or 99999 passed the check; two clicks on Save sent the settings twice; an app
  in the App Store whose details could not be read left the store under its loading overlay; an error with no answer
  from the server broke the message instead of showing it.
- **On a phone** the five tabs of the app panel widened it past the screen; they scroll inside their bar now. The
  login card of the server's terminal fits a phone too.
- **Keyboard:** in the file manager, Enter, Space and Backspace on a toolbar button or a Cancel in the upload list
  went to the list instead of the button; Ctrl+K in a terminal opened the command palette over it; Escape and Tab in
  the palette also reached a panel open under it.
- **Home:** a failed first read of the hardware or of the widget layout hid the widgets until a reload; they come
  back by themselves now, and the saved layout is not written over.
- **Logs:** switching to another app while the logs of the first were loading left the new ones empty for a few
  seconds, and an app whose logs cannot be read showed "Loading…" forever.
- A tile could show no name for an app whose title is missing; a failed save of the account name said nothing;
  changing CasaOS's port waited forever when CasaOS did not come back on it; a failed try to start an Atrio update
  could block the next ones; downloading folders whose names have a comma made a broken ZIP, and now says so.
- App names and messages from the server are shown as text in every message, and a few messages that were only in
  English are translated, along with "Port" and "Ports", which were swapped in Italian.

## 0.1.23 — 2026-11-16

**Changed**

- **The history charts are thin strips now**, one per measure (processor, memory, received, sent, processor and
  hottest disk temperature) on one time axis, in place of four separate charts. Moving the mouse, or the arrow keys,
  moves one line across all of them and shows every value at that moment, so what happened together is easy to
  see; the peak is on the right. The disks' temperatures use the same strips, one per disk.

**Fixed**

- **Network detail:** closing and opening it again quickly could start two measures at once, or end in a false
  "another backup is in progress"; a measure while the server was busy showed the previous one as new, and now says
  the server is busy. With an older service the last 24 hours say they need the latest one, instead of showing
  zeros. On a phone the received and sent columns no longer run into each other, and the share bar shows.
- **Network counts:** an app whose containers share one network (`network_mode: service:...`, like a VPN
  container) was counted twice; a failed read of the connections no longer makes the next one count all their
  bytes again.
- **Disk self-tests:** a disk seen for the first time gets its first short test the next night instead of right
  after the update; a test asked from the panel while the server was busy looked started but was not; a test
  asked from the panel no longer sends a push alert with alerts turned off.
- **Hardware panel:** a disk alone between gaps shows on its strip, quick switches between 24 hours and 7 days
  no longer show the wrong range, the panel no longer scrolls to the disks by itself after one was opened from the
  Storage widget, and on a phone the disk details wrap instead of being cut. The strips follow a finger too.
- Turning the self-tests off in the hardware panel was undone by saving the push alert settings when those were
  already open.
- **Safe updates:** an app on the same tag (like `latest`) whose new image did not start went back to its backup
  but kept running the new image; it gets its old image back now. Two quick clicks on Update no longer start two
  updates, and other actions on an app no longer show "Backing up" on its tile.
- **Atrio updates** never go back to an older release, even a signed one; an update asked while another was running
  could leave the update button dead until a restart.
- **Backups:** automatic backups loaded with the settings on a new machine were dropped before the apps were
  restored, and now wait a week for them; the backup an app was just put back to is never pruned; uninstalling
  Atrio keeps the backup key, without which its backups cannot be read.
- **Unused images:** "Remove all" removes the images on the list, not others that became unused since; a request
  naming no valid image removed every unused one.
- A request the backup service did not pick up no longer runs later, after the page said it failed, and one that
  stopped halfway no longer leaves the page waiting forever. Copying the install command or the backup key says when
  the browser could not copy (plain HTTP). App names are shown as text in every message. Activity shows failed
  schedule changes correctly, the alert limits take whole numbers only, and the outdated-services notice no longer
  shows when the server only failed to answer.

**Updating**

From 0.1.17 or later, Update in the settings brings the new services on the server too. From an older version, run
the install command once more; Atrio shows a notice with it when its services are out of date:

```
curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
```

## 0.1.22 — 2026-11-16

**Fixed**

- **A disk self-test that was running did not show in the hardware panel**, so "Short test" answered that a test
  was already running with nothing on screen to say so (the first scheduled test starts right after the update).
  While a test runs the disks are now read every 5 minutes instead of every hour, so the panel shows it and its
  result soon after it ends, and a refused test shows the one that is running.

## 0.1.21 — 2026-11-16

**New**

- **Charts of the last 24 hours and 7 days**, in the hardware panel: processor, memory, network received and sent,
  and the temperatures of the processor and the hottest disk, with the values at any time on hover and gaps where
  the server was off. Below them, how much memory and CPU each app uses now. The server keeps a point every 5
  minutes for a week, also with push alerts off, counting only the real network cards (not Docker's bridges).
- **Network detail**, from the numbers of the Network Status widget, its new button or the command palette: which
  apps and which of the server's services (Samba, SSH, CasaOS…) are receiving and sending data, now (measured every
  few seconds while it is open) or over the last 24 hours. The totals on top, a bar with each app's share, and a list
  with each app's own icon. Apps with their own network are counted exactly; apps on the server's network, like
  Home Assistant, and the services are counted from their TCP connections.
- **The home's widgets show more.** Storage shows the disks' SMART verdict (Good, Keep an eye on it, Replace soon)
  instead of CasaOS's pass or fail, with each disk's model, temperature and wear; a click opens them in the hardware
  panel. Network Status shows the app that used the network most in the last 5 minutes, with its icon.
- **Disk self-tests.** The server has each disk run a short SMART self-test every week and a long one (a full read)
  every month, at night, or at any hour once two days late; the disk runs it on its own and keeps working. The
  hardware panel shows the latest result and a test in progress, and has buttons to start one now. A failed test
  turns the disk to Replace soon and sends the alert. They can be turned off below the disks.
- **Each disk's temperature over time**, in the hardware panel below the disks: one line per disk for the last 24
  hours or 7 days, from the hourly SMART reading, with gaps while a disk sleeps.

**Updating**

From 0.1.17 or later, Update in the settings brings the new services on the server too. From an older version, run
the install command once more; Atrio shows a notice with it when its services are out of date:

```
curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
```

## 0.1.20 — 2026-11-15

**New**

- **App health.** Every 5 minutes the server looks at each app: one that keeps restarting, stopped on its own, fails
  its own health check, or runs while its page does not answer at all (a login page or an error page are fine) gets
  a red label on its tile, an entry in Activity and, if you want, a push alert, and another one when it works again.
  It counts once it is seen twice in a row, so restarts and updates are not taken for a problem, and an app stopped
  by you is not one. The alert can be turned off in the push alert settings, under "Apps that stop working".
- **Disk health**, in the hardware panel: every hour the server reads each disk's SMART data, without waking disks
  that sleep, and shows its temperature, hours powered on, wear and the counters that matter, with a verdict (Good,
  Keep an eye on it, Replace soon) and what it is based on: sectors waiting to be replaced, errors the disk could
  not correct, reallocated sectors, wear, cable errors, heat, age. A verdict that gets worse goes to Activity and to
  push alerts, under "Disk health problems", instead of waiting for the disk's own pass or fail.
- **Quiet hours, limits and apps without alerts**, in the push alert settings. In quiet hours (say 23:00 to 07:00)
  what is not urgent waits and arrives in one message when they end; a disk that may fail soon is sent at once. The
  limits for a disk almost full and a hot processor can be set, and apps can be left out of alerts while their
  changes and problems still show in Activity and on their tiles.

**Fixed**

- A sharp line in the wallpaper, like the snowy ridge of the default one, showed through the app tiles as a line
  across them: the glass of tiles and panels blurs twice as much now.
- **The install command from the web terminal of CasaOS or Atrio** looked stuck at "Installing Atrio": that terminal
  goes through the CasaOS gateway, which the updater restarts, so its session closed there. The install did finish,
  but did not say so. Now it says before the restart that the window will close and that the install goes on, and
  it finishes to the end even with the terminal gone.

## 0.1.19 — 2026-11-15

**New**

- **Atrio says when the services on the server are older than the web UI.** Installs made before 0.1.17 update only
  the web UI from the settings, so backups, push alerts and safe updates keep running an older service, or none. The
  Atrio row in the settings and a notification now show the install command to run once; after that, updates bring
  the services too.

**For developers**

- **Tests for the services on the server.** `pnpm test:server` runs about 150 checks of the updater, push alerts,
  backups and setup: backups and restores, refused archives and settings files, schedules, updates and the way back,
  image cleanup, signed releases. Each runs in a sandbox with a fake docker, and GitHub runs them on every change.
  `atrio-update` and `atrio-setup` take `ATRIO_STATE`, `ATRIO_WWW` and `ATRIO_ROOT` for that.

## 0.1.18 — 2026-11-13

**If you installed Atrio before 0.1.17, run the install command once more**, even after updating from the settings:
until 0.1.17, updates from the settings changed only the web UI, so the new backups, safe updates and activity log
need the services on the server to be updated once. After that, updates from the settings bring them too.

```
curl -fsSL https://raw.githubusercontent.com/peppeaiello/atrio/main/scripts/install.sh | sudo bash
```

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
  downloads the new image of the same tag, recreates the app and checks that it stays up. The tag never changes, and
  nothing updates on its own. Apps pinned to a digest, and images built on the server, are left out.
- **Ignore updates** in an app's menu turns its Update available badge off, for an app you keep on its version on
  purpose. It can still be updated from the same menu, and Show updates again brings the badge back.
- **Activity**, a tab of the notification centre (also opened from Settings → System and the command palette): what
  happened on the server, newest first and by day. Apps installed, removed and updated (also outside Atrio), backups
  by hand, automatic and before updates, restores, backup folder and schedule changes, image cleanups, settings files
  and Atrio's own updates, with the reason when something failed. The services on the server write it, so it is
  there even when nobody had Atrio open.
- **Safe updates, run by the server.** Updates to the App Store's version now go through the server too, like the
  ones above: a backup first, then the App Store's image written in the app's compose file (only the image line of
  each service, and only another version of the same image), the download, the app recreated and a check that it
  stays up. If the new version does not start, the app goes back on its own to the backup made just before, compose
  file and data, also with no browser open, and the tile says so. A failed download leaves the app as it was.
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
