#!/bin/bash
# Folder backups: adding a folder, backing it up by hand and on a schedule, putting a backup back as
# a copy or in its place, and what is refused.
. "$(dirname "$0")/lib.sh"
sandbox
index="$ATRIO_STATE/folder-backups.json"
log="$ATRIO_STATE/activity.log"
photos="$SB/docs/My Photos"
mkdir -p "$photos/2026"
echo "first" > "$photos/2026/a.txt"
job=$(printf '%s' "$photos" | sha256sum | cut -c1-12)
store="$ATRIO_BACKUP_DEST/@folders/$job"
backups() { ls "$store"/*.info 2>/dev/null | wc -l; }

request ACTION=folder-save APP=atrio "FOLDER=$photos/"
check "a folder is added" is "$STATE_" done
check "under a name made from its path" test -f "$ATRIO_STATE/folder-jobs/$job"
check "the panel lists it" has "$index" "\"job\":\"$job\",\"path\":\"$photos\",\"added\":true,\"present\":true"
check "with no schedule yet" has "$index" '"schedule":null'
for bad in /etc "$ATRIO_APPS/web" "$ATRIO_BACKUP_DEST/x" "$ATRIO_STATE" "$SB/docs/missing" /DATA; do
	mkdir -p "$ATRIO_BACKUP_DEST/x"
	request ACTION=folder-save APP=atrio "FOLDER=$bad"
	check "$bad cannot be backed up" is "$MESSAGE" "This folder cannot be backed up: choose another one"
done
ln -s "$photos" "$SB/docs/link"
request ACTION=folder-save APP=atrio "FOLDER=$SB/docs/link"
check "nor a symbolic link" is "$MESSAGE" "This folder cannot be backed up: choose another one"

request ACTION=folder-backup APP=atrio JOB="$job"
check "a backup by hand is made" is "$STATE_" done
first="$ID"
check "in the backup folder, apart from the apps" test -f "$store/$first.tar.gz"
check "encrypted" is "$(head -c 2 "$store/$first.tar.gz" | od -An -tx1 | tr -d ' ')" "5361"
check "and signed" has "$store/$first.info" "MAC="
check "the panel lists the backup" has "$index" "\"id\":\"$first\""
check "the activity log names the folder" has "$log" "folder-backup	ok	$photos	manual $first"

echo "changed" > "$photos/2026/a.txt"
echo "new" > "$photos/new.txt"
request ACTION=folder-restore APP=atrio JOB="$job" ID="$first" MODE=copy
check "a backup is restored as a copy" is "$STATE_" done
copy=$(ls -d "$SB/docs/My Photos (backup "* 2>/dev/null | head -n 1)
check "next to the folder" test -n "$copy"
check "the copy holds the files of then" is "$(cat "$copy/2026/a.txt")" first
check "without the newer ones" test ! -e "$copy/new.txt"
check "the folder itself is not touched" is "$(cat "$photos/2026/a.txt")" changed
check "the page is told where it went" is "$MESSAGE" "$copy"
check "nothing is left behind" is "$(ls -A "$SB/docs" | grep -c atrio-restore)" 0
request ACTION=folder-restore APP=atrio JOB="$job" ID="$first" MODE=copy
check "a second copy gets a name of its own" is "$(ls -d "$SB/docs/My Photos (backup "* | wc -l)" 2

request ACTION=folder-restore APP=atrio JOB="$job" ID="$first" MODE=replace
check "a backup is restored in place" is "$STATE_" done
check "the folder is as it was" is "$(cat "$photos/2026/a.txt")" first
check "without the newer files" test ! -e "$photos/new.txt"
aside=$(ls -d "$SB/docs/My Photos (before restore "* 2>/dev/null | head -n 1)
check "the folder as it was before is kept aside" is "$(cat "$aside/new.txt" 2>/dev/null)" new
check "the restore is logged" has "$log" "folder-restore	ok	$photos	replace $photos"

# Changed backups are never put back
cp "$store/$first.info" "$SB/info.saved"
sed -i "s|^FOLDER=.*|FOLDER=$SB/docs/other|" "$store/$first.info"
request ACTION=folder-restore APP=atrio JOB="$job" ID="$first" MODE=replace
check "a changed backup is refused" is "$MESSAGE" "This backup was changed after it was made, or made on another server, and was not restored"
cp "$SB/info.saved" "$store/$first.info"
request ACTION=folder-restore APP=atrio JOB="$job" ID="$first"
check "a restore needs to say how" is "$STATE_" error

# On a schedule, keeping the last 2 automatic ones and the one by hand
run_due() {
	sed -i 's/^SLOT=.*/SLOT=1/' "$ATRIO_STATE/folder-jobs/$job"
	bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
	sleep 1
}
request ACTION=folder-save APP=atrio JOB="$job" EVERY=daily TIME=03:00 KEEP=2
check "a schedule is saved" has "$index" '"schedule":{"every":"daily","time":"03:00","day":1,"keep":2'
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "nothing runs before the next planned time" is "$(backups)" 1
run_due
run_due
run_due
check "only the last 2 automatic ones are kept, and the one by hand" is "$(backups)" 3
check "the one by hand stays" test -f "$store/$first.info"
check "the panel shows the last one" has "$index" '"last_error":""'
request ACTION=folder-save APP=atrio JOB="$job" EVERY=daily TIME=27:00 KEEP=2
check "a wrong time is refused" is "$MESSAGE" "The schedule is not valid"

# A disk that is not plugged in leaves an empty folder: never backed up in place of the real one
sed -i 's|^MOUNT=.*|MOUNT=/nowhere|' "$ATRIO_STATE/folder-jobs/$job"
run_due
check "a folder whose disk is gone is not backed up" is "$(backups)" 3
check "the failure is recorded" has "$ATRIO_STATE/folder-jobs/$job" "LAST_ERROR=The folder is not there: plug in its disk or reconnect it"
printf 'ENABLED=1\nSERVICE=ntfy\nURL=https://ntfy.example\nTOPIC=t\nDISK=0\nHEALTH=0\nTEMP=0\nAPPS=0\nAPP_UPDATES=0\nUPDATES=0\nLANGUAGE=en\n' > "$ATRIO_STATE/alerts.conf"
bash "$SCRIPTS/atrio-alerts" >/dev/null 2>&1
check "and sends a push alert" has "$FAKE_DOCKER/sent.log" "The automatic backup of $photos failed: The folder is not there"
bash "$SCRIPTS/atrio-alerts" >/dev/null 2>&1
check "once" is "$(grep -c "automatic backup of $photos" "$FAKE_DOCKER/sent.log")" 1
sed -i "s|^MOUNT=.*|MOUNT=$(findmnt -n -o TARGET --target "$photos")|" "$ATRIO_STATE/folder-jobs/$job"

# The settings file brings the folders back on a new machine
echo '{}' > "$ATRIO_STATE/settings-ui.json"
request ACTION=export-settings APP=atrio "PASSWORD=long enough"
cp "$ATRIO_STATE/settings-export.txt" "$ATRIO_STATE/settings-import.txt"
rm -f "$ATRIO_STATE/folder-jobs/$job"
request ACTION=import-settings APP=atrio "PASSWORD=long enough"
check "the settings file brings the folder back" has "$ATRIO_STATE/folder-jobs/$job" "PATH=$photos"
check "with its schedule" has "$ATRIO_STATE/folder-jobs/$job" "KEEP=2"

later=$(ls "$store"/*.info | sort | tail -n 1 | xargs basename | sed 's/\.info$//')
request ACTION=folder-delete APP=atrio JOB="$job" ID="$later"
check "a backup is deleted" test ! -e "$store/$later.tar.gz"
check "and logged" has "$log" "folder-delete	ok	$photos	$later"

request ACTION=folder-remove APP=atrio JOB="$job"
check "a folder is taken off" test ! -e "$ATRIO_STATE/folder-jobs/$job"
check "its backups stay, and stay listed" has "$index" "\"job\":\"$job\",\"path\":\"$photos\",\"added\":false"
check "with the backups" has "$index" "\"id\":\"$first\""
request ACTION=folder-backup APP=atrio JOB="$job"
check "a folder taken off is not backed up" is "$MESSAGE" "Unknown folder"
finish
