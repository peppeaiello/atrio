#!/bin/bash
# Servers without the Docker Compose plugin (#11): CasaOS has compose built in, so Docker from the
# distribution's packages often comes without it. Everything that does not recreate containers works
# without compose; restoring and updating use the standalone docker-compose when it is there, and
# otherwise Atrio's own copy of the official binary, downloaded once and checked against its hash.
. "$(dirname "$0")/lib.sh"
sandbox
new=sha256:$(printf '2%.0s' {1..64})
docker_state "state['remote'] = {'registry-1.docker.io/library/nginx:1.0': '$new'}"
docker_state "state['registry'] = {'nginx:1.0': {'id': 'sha256:cccc', 'digest': '$new'}}"
touch "$FAKE_DOCKER/no-compose-plugin"

# The standalone docker-compose is used in place of the plugin
request ACTION=backup APP=web "FOLDER=$ATRIO_APPDATA/web/config"
check "a backup works without the plugin" is "$STATE_" done
backup_id=$ID
request ACTION=update-app APP=web
check "an update works with the standalone docker-compose" is "$STATE_ $MESSAGE" "done "
check "which is the one that ran" has "$FAKE_DOCKER/calls.log" "docker-compose -p web"
check "and the app runs the new image" is "$(docker_query "state['containers'][0]['image']")" sha256:cccc
bash "$SCRIPTS/atrio-backup" --check-updates
check "with a compose there, nothing is downloaded" test ! -e "$ATRIO_COMPOSE_DIR"

# The old docker-compose 1.x refuses CasaOS's compose files: it counts as no compose at all
touch "$FAKE_DOCKER/standalone-v1"
: > "$FAKE_DOCKER/calls.log"
ATRIO_COMPOSE_URL="file://$SB/no-release" request ACTION=update-app APP=web
check "the old docker-compose 1.x is not used" lacks "$FAKE_DOCKER/calls.log" "docker-compose -p web"
check "and Atrio's own copy is looked for instead" is "${MESSAGE%%,*}" "Docker Compose is not installed on the server"
rm "$FAKE_DOCKER/standalone-v1"

# Neither the plugin nor the standalone one, and no network: GitHub cannot be reached
touch "$FAKE_DOCKER/no-standalone"
docker_state "state['registry']['nginx:1.0'] = {'id': 'sha256:dddd', 'digest': 'sha256:' + '3' * 64}"
docker_state "state['remote']['registry-1.docker.io/library/nginx:1.0'] = 'sha256:' + '3' * 64"
offline="Docker Compose is not installed on the server, and Atrio could not download it: check the server's internet connection, or install the docker-compose-plugin package"
nothing_installed() { [ ! -e "$ATRIO_COMPOSE_DIR/docker-compose" ] && [ -z "$(ls -A "$ATRIO_COMPOSE_DIR" 2>/dev/null)" ]; }
request ACTION=images APP=atrio
check "unused images are listed without compose" is "$STATE_" done
bash "$SCRIPTS/atrio-backup" --check-updates
check "updates are checked without compose" has "$ATRIO_STATE/updates.json" '"web":{"state":"update"'
check "and Docker Compose is fetched ahead, from its GitHub release" has "$FAKE_DOCKER/calls.log" "curl https://github.com/docker/compose/releases/download/v5.6.1/docker-compose-linux-"
check "which fails offline and leaves nothing" nothing_installed
request ACTION=backup APP=web "FOLDER=$ATRIO_APPDATA/web/config"
check "a backup still works" is "$STATE_" done
check "and the app is running again after it" is "$(docker_query "state['containers'][0]['state']")" running
request ACTION=update-app APP=web
check "an update offline says what is missing" is "$MESSAGE" "$offline"
check "and changes nothing" is "$(docker_query "state['containers'][0]['image']")" sha256:cccc
check "the app keeps running" is "$(docker_query "state['containers'][0]['state']")" running
check "and nothing is installed" nothing_installed
request ACTION=restore APP=web "ID=$backup_id"
check "a restore says so too, before touching anything" is "$MESSAGE" "$offline"
check "with the app still running" is "$(docker_query "state['containers'][0]['state']")" running
bash "$SCRIPTS/atrio-backup" --auto-update-app web >/dev/null 2>&1
read_status
check "a nightly update stops the same way" is "$MESSAGE" "$offline"

# A release served from a folder: a "binary" that hands over to the fake docker's compose
release="$SB/release"
mkdir -p "$release"
cat > "$release/docker-compose-linux-x86_64" <<SCRIPT
#!/bin/sh
echo "atrio-compose \$*" >> "\$FAKE_DOCKER/calls.log"
FAKE_STANDALONE=1 exec "$TESTS/fake/docker" compose "\$@"
SCRIPT
sum=$(sha256sum < "$release/docker-compose-linux-x86_64" | cut -d' ' -f1)
export ATRIO_COMPOSE_URL="file://$release" ATRIO_COMPOSE_ARCH=x86_64

# A file that is not the expected one is never installed, nor run
export ATRIO_COMPOSE_SHA256=$(printf '0%.0s' {1..64})
request ACTION=update-app APP=web
check "a download with another hash is refused" is "$MESSAGE" "The Docker Compose that was downloaded is not the expected one, and was not used: try again later, or install the docker-compose-plugin package"
check "and nothing is installed" nothing_installed
check "nor run" lacks "$FAKE_DOCKER/calls.log" "atrio-compose"
check "and the app is not changed" is "$(docker_query "state['containers'][0]['image']")" sha256:cccc
export ATRIO_COMPOSE_SHA256="$sum"

# A full disk: half a file, then nothing
touch "$FAKE_DOCKER/disk-full"
request ACTION=update-app APP=web
check "a full disk is said as such" is "$MESSAGE" "Docker Compose is not installed on the server, and there is not enough space to download it (about 35 MB in /usr/local): free some space, or install the docker-compose-plugin package"
check "and the half-written file is gone" nothing_installed
rm "$FAKE_DOCKER/disk-full"

# A processor with no release
ATRIO_COMPOSE_ARCH=mips64 request ACTION=update-app APP=web
check "a processor with no release is said as such" is "$MESSAGE" "Docker Compose is not installed on the server, and Atrio cannot download it for this processor: install the docker-compose-plugin package"
check "and the app keeps running" is "$(docker_query "state['containers'][0]['state']")" running

# Downloaded, then used for the update
request ACTION=update-app APP=web
check "an update downloads Docker Compose and works" is "$STATE_ $MESSAGE" "done "
check "it is installed, executable" test -x "$ATRIO_COMPOSE_DIR/docker-compose"
check "with nothing left beside it" is "$(ls -A "$ATRIO_COMPOSE_DIR")" docker-compose
check "the downloaded one is what ran" has "$FAKE_DOCKER/calls.log" "atrio-compose -p web --project-directory $ATRIO_APPS/web -f $ATRIO_APPS/web/docker-compose.yml up -d"
check "and the app runs the new image" is "$(docker_query "state['containers'][0]['image']")" sha256:dddd
check "and is running" is "$(docker_query "state['containers'][0]['state']")" running

# Used again with no network: a restore works offline
mv "$release" "$release.gone"
: > "$FAKE_DOCKER/calls.log"
request ACTION=restore APP=web "ID=$backup_id"
check "a restore reuses it, also offline" is "$STATE_ $MESSAGE" "done "
check "with the downloaded compose" has "$FAKE_DOCKER/calls.log" "atrio-compose -p web"
mv "$release.gone" "$release"

# A copy that is not the expected one (damaged, or from an older Atrio) is downloaded again
echo "# changed" >> "$ATRIO_COMPOSE_DIR/docker-compose"
request ACTION=update-app APP=web
check "a changed copy is replaced before use" is "$STATE_ $MESSAGE" "done "
check "by the expected one" is "$(sha256sum < "$ATRIO_COMPOSE_DIR/docker-compose" | cut -d' ' -f1)" "$sum"

# Ahead of time, with the check for new images; a failed download is tried again a day later
rm -rf "$ATRIO_COMPOSE_DIR"
touch "$ATRIO_STATE/compose-download-failed"
bash "$SCRIPTS/atrio-backup" --check-updates
check "a download that failed today is not tried again at once" test ! -e "$ATRIO_COMPOSE_DIR/docker-compose"
touch -d '2 days ago' "$ATRIO_STATE/compose-download-failed"
bash "$SCRIPTS/atrio-backup" --check-updates
check "the check for new images fetches it ahead" test -x "$ATRIO_COMPOSE_DIR/docker-compose"
check "and forgets the failure" test ! -e "$ATRIO_STATE/compose-download-failed"
mv "$release" "$release.gone"
request ACTION=restore APP=web "ID=$backup_id"
check "so a restore works offline later" is "$STATE_ $MESSAGE" "done "
finish
