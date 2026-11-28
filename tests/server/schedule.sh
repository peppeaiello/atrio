#!/bin/bash
# Automatic backups: schedules, when they run, how many are kept, and what a failure leaves.
. "$(dirname "$0")/lib.sh"
sandbox
# run_due: the planned time has come (the last one done is long ago), then the timer runs
run_due() {
	sed -i 's/^SLOT=.*/SLOT=1/' "$ATRIO_STATE/schedules/web"
	bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
	sleep 1
}

request ACTION=backup APP=web "FOLDER=$ATRIO_APPDATA/web/config"
request ACTION=schedule APP=web EVERY=daily TIME=03:00 KEEP=2 "FOLDER=$ATRIO_APPDATA/web/config"
check "a daily schedule is saved" is "$STATE_" done
check "the tab sees it" has "$ATRIO_STATE/backups/web.json" '"schedule":{"every":"daily","time":"03:00","day":1,"keep":2'
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "nothing runs before the next planned time" is "$(count_backups web)" 1

run_due
check "a backup runs once its time has come" is "$(count_backups web)" 2
check "it is marked as automatic" has "$ATRIO_STATE/backups/web.json" '"reason":"scheduled"'
check "the tab shows the last one" has "$ATRIO_STATE/backups/web.json" '"last_error":""'
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "and does not run twice for the same time" is "$(count_backups web)" 2
run_due
run_due
check "only the last 2 automatic ones are kept, and the one by hand" is "$(count_backups web)" 3
check "the one by hand stays" test "$(grep -l REASON=manual "$ATRIO_BACKUP_DEST"/web/*.info | wc -l)" -eq 1

request ACTION=schedule APP=web EVERY=weekly TIME=04:30 DAY=3 KEEP=5
check "a weekly schedule is saved" has "$ATRIO_STATE/schedules/web" "DAY=3"
slot=$(sed -n 's/^SLOT=//p' "$ATRIO_STATE/schedules/web")
check "its first time is a Wednesday at 04:30" is "$(date -d "@$slot" '+%u %H:%M')" "3 04:30"
# Summer time starts today at 02:00 (a zone made up for the test): 02:30 does not exist today, and
# the backup at that time runs once the clock has jumped, instead of the schedule being refused.
# The zone is set so that it is about noon there now: near midnight, the jump to summer time would
# move its clock to the next day, and "today" would no longer be the day of the jump
offset=$(( 10#$(date -u +%H) - 12 ))
today=$(( 10#$(TZ="XST$offset" date +%j) - 1 ))
gap="XST${offset}XDT,$today/2,$(( (today + 100) % 365 ))/3"
TZ="$gap" request ACTION=schedule APP=web EVERY=daily TIME=02:30 KEEP=2
check "a time the clock skips today is taken" is "$STATE_" done
slot=$(sed -n 's/^SLOT=//p' "$ATRIO_STATE/schedules/web")
if [ "$(TZ="$gap" date +%H%M)" -ge 0330 ]; then expected="$(TZ="$gap" date '+%F') 03:30"; else expected="$(TZ="$gap" date -d yesterday '+%F') 02:30"; fi
check "and its time today is just after the jump" is "$(TZ="$gap" date -d "@$slot" '+%F %H:%M')" "$expected"
TZ="$gap" request ACTION=schedule APP=web EVERY=weekly TIME=02:30 DAY="$(TZ="$gap" date -d tomorrow +%u)" KEEP=2
check "a weekly time past such a day is taken too" is "$STATE_" done
for bad in "EVERY=hourly TIME=03:00 KEEP=2" "EVERY=daily TIME=25:00 KEEP=2" "EVERY=daily TIME=03:00 KEEP=99" "EVERY=weekly TIME=03:00 DAY=9 KEEP=2"; do
	# shellcheck disable=SC2086
	request ACTION=schedule APP=web $bad
	check "a schedule with $bad is refused" is "$MESSAGE" "The schedule is not valid"
done

# A failure is kept for the tab and the push alert, and the other apps still get theirs
add_app other redis:7 sha256:bbbb
request ACTION=schedule APP=other EVERY=daily TIME=03:00 KEEP=2 "FOLDER=$ATRIO_APPDATA/other/config"
request ACTION=schedule APP=web EVERY=daily TIME=03:00 KEEP=2
printf 'DEST=/proc/nope/atrio-backups\nMOUNT=\n' > "$ATRIO_STATE/backup.conf"
sed -i 's/^SLOT=.*/SLOT=1/' "$ATRIO_STATE/schedules/web" "$ATRIO_STATE/schedules/other"
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "a failed automatic backup is recorded" has "$ATRIO_STATE/schedules/web" "LAST_ERROR=The backup folder is not valid"
check "and the next app is still tried" has "$ATRIO_STATE/schedules/other" "LAST_ERROR=The backup folder is not valid"
rm -f "$ATRIO_STATE/backup.conf"

request ACTION=schedule APP=web EVERY=off
check "a schedule can be turned off" test ! -e "$ATRIO_STATE/schedules/web"
check "the tab sees no schedule" has "$ATRIO_STATE/backups/web.json" '"schedule":null'

# An app that is uninstalled loses its schedule, and its list once it has no backups
rm -rf "$ATRIO_APPS/other"
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "the schedule of an app not installed waits (loaded with the settings on a new machine)" test -e "$ATRIO_STATE/schedules/other"
touch -d '8 days ago' "$ATRIO_STATE/schedules/other"
bash "$SCRIPTS/atrio-backup" --scheduled >/dev/null 2>&1
check "the schedule of an uninstalled app goes away after a week" test ! -e "$ATRIO_STATE/schedules/other"
check "and its list too, as it has no backups" test ! -e "$ATRIO_STATE/backups/other.json"

# A request that comes while a run holds the lock without saying "running" (between two automatic
# backups, asking the registries): the web UI drops a request after 30 seconds of that, so the one
# waiting says it is waiting, also after the run writes its status again
status_line() { printf '{"state":"%s","action":"backup","app":"web","id":"20260101-040000","step":"","message":"","token":"","time":"x"}\n' "$1" > "$ATRIO_STATE/backup-status.json"; }
status_line done
( flock 9; sleep 9 ) 9>"$ATRIO_STATE/backup.lock" &
holder=$!
sleep 0.5
printf '%s\n' ACTION=scan APP=web TOKEN=waits > "$ATRIO_STATE/backup-request"
bash "$SCRIPTS/atrio-backup" >/dev/null 2>&1 &
waiter=$!
sleep 3
read_status
check "a waiting request shows the service as running" is "$STATE_" running
check "and keeps what the run reads there" is "$ID" 20260101-040000
status_line done
sleep 3
read_status
check "also after the run reports again" is "$STATE_" running
wait "$holder" "$waiter"
check "the request is then done" has "$ATRIO_STATE/backup-status.json" '"state":"done","action":"scan","app":"web","id":"","step":"","message":"","token":"waits"'

# The page gave up and removed its request while it waited: the status does not stay on "running"
status_line done
( flock 9; sleep 5 ) 9>"$ATRIO_STATE/backup.lock" &
holder=$!
sleep 0.5
printf '%s\n' ACTION=scan APP=web TOKEN=gone > "$ATRIO_STATE/backup-request"
bash "$SCRIPTS/atrio-backup" >/dev/null 2>&1 &
waiter=$!
sleep 3
rm -f "$ATRIO_STATE/backup-request"
wait "$holder" "$waiter"
read_status
check "a request removed while waiting leaves the service idle" is "$STATE_" idle
finish
