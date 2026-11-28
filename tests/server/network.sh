#!/bin/bash
# Network per app: exact counters from each container's network, rates every 5 minutes in the
# history, a live measure for the network detail, and apps on the host's network told apart.
. "$(dirname "$0")/lib.sh"
sandbox
export ATRIO_PROC="$SB/proc" ATRIO_SYS="$SB/sys" ATRIO_NETWORK_WAIT=2
mkdir -p "$ATRIO_PROC/101/net" "$ATRIO_PROC/102/net" "$ATRIO_SYS/class/net/eth0/statistics" "$ATRIO_SYS/class/net/eth0/device"
printf 'MemTotal: 1000 kB\nMemAvailable: 500 kB\n' > "$ATRIO_PROC/meminfo"
echo "cpu  1 0 1 1 0 0 0 0 0 0" > "$ATRIO_PROC/stat"
echo "0.1 0.1 0.1 1/1 1" > "$ATRIO_PROC/loadavg"
add_app media redis:7 sha256:bbbb
add_app home redis:7 sha256:bbbb
add_app tunnel redis:7 sha256:bbbb
docker_state "state['containers'][0].update(pid=101); state['containers'][1].update(pid=102); state['containers'][2].update(pid=1, mode='host'); state['containers'][3].update(pid=101, mode='container:aaaa')"
# dev PID RX TX: the network of a container, with its loopback
dev() {
	printf 'Inter-|   Receive                                                |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n'
	printf '    lo: 999999 1 0 0 0 0 0 0 999999 1 0 0 0 0 0 0\n  eth0: %s 1 0 0 0 0 0 0 %s 1 0 0 0 0 0 0\n' "$2" "$3"
}
server() { echo "$1" > "$ATRIO_SYS/class/net/eth0/statistics/rx_bytes"; echo "$2" > "$ATRIO_SYS/class/net/eth0/statistics/tx_bytes"; }
dev 101 1000000 200000 > "$ATRIO_PROC/101/net/dev"
dev 102 50000 10000 > "$ATRIO_PROC/102/net/dev"
server 5000000 1000000
alerts() { bash "$SCRIPTS/atrio-alerts" "$@" >/dev/null 2>&1; }
apps_row() { awk -F'\t' -v app="$1" '$2 == app' "$ATRIO_STATE/history-apps.tsv" | tail -n 1 | cut -f"$2"; }

alerts
check "the first sample has no rate yet" is "$(apps_row web 5)" ""
check "an app on the host's network has no rate in the first sample either" is "$(apps_row home 5)" ""
dev 101 4000000 800000 > "$ATRIO_PROC/101/net/dev"
sed -i "s/^apps_net=\([0-9]*\)/apps_net=$(( $(date +%s) - 300 ))/" "$ATRIO_STATE/alerts-memory"
alerts
# 300 seconds, or 301 when the clock ticks between the line above and the run (on a slow runner)
within() { [ -n "$1" ] && [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]; }
check "an app's download over 5 minutes, without its loopback" within "$(apps_row web 5)" 9900 10000
check "and its upload" within "$(apps_row web 6)" 1980 2000
check "an app with no traffic" is "$(apps_row media 5)" 0
check "a container on another's network (network_mode: service) is not counted again" is "$(apps_row tunnel 5)" ""

# The live measure: counters read twice a few seconds apart
( sleep 1; dev 101 4600000 800000 > "$ATRIO_PROC/101/net/dev"; server 6000000 1000000 ) &
printf '%s\n' ACTION=network APP=atrio > "$ATRIO_STATE/backup-request"
bash "$SCRIPTS/atrio-backup" >/dev/null 2>&1
wait
read_status
check "the network is measured on request" is "$STATE_" done
net() { python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$ATRIO_STATE/network.json" "$1"; }
check "an app downloading now" test "$(net "next(a['down'] for a in d['apps'] if a['app'] == 'web')")" -ge 250000
check "an app doing nothing now" is "$(net "next(a['down'] for a in d['apps'] if a['app'] == 'media')")" 0
check "an app on the host's network is marked" is "$(net "next(a.get('host') for a in d['apps'] if a['app'] == 'home')")" True
check "the whole server too" test "$(net "d['server']['down']")" -ge 400000
check "the result can be read by the web UI" is "$(stat -c %a "$ATRIO_STATE/network.json")" 644

# Apps on the host's network and the server's services, from their TCP connections
mkdir -p "$ATRIO_PROC/201" "$ATRIO_PROC/202" "$ATRIO_PROC/203" "$ATRIO_PROC/204"
echo "0::/system.slice/docker-$(printf 'h%.0s' {1..8}).scope" > "$ATRIO_PROC/201/cgroup"
echo "0::/system.slice/smbd.service" > "$ATRIO_PROC/202/cgroup"
echo "0::/system.slice/casaos-gateway.service" > "$ATRIO_PROC/203/cgroup"
echo "0::/system.slice/docker.service" > "$ATRIO_PROC/204/cgroup"
docker_state "state['containers'][2]['id'] = 'hhhhhhhh'"
# sockets HOME_RX SMB_RX: a connection of Home Assistant, one of Samba, one of CasaOS, one of
# Docker itself and one inside the server, as ss -tinpH prints them
sockets() {
	cat > "$FAKE_DOCKER/sockets" <<SS
ESTAB 0 0 192.168.1.10:8123 192.168.1.20:51000 users:(("python3",pid=201,fd=30))
	 cubic bytes_sent:500 bytes_acked:$3 bytes_received:$1 segs_out:3
ESTAB 0 0 192.168.1.10:445 192.168.1.20:51001 users:(("smbd",pid=202,fd=33))
	 cubic bytes_acked:100 bytes_received:$2 segs_out:3
ESTAB 0 0 192.168.1.10:80 192.168.1.20:51002 users:(("casaos-gateway",pid=203,fd=9))
	 cubic bytes_acked:7000 bytes_received:3000
ESTAB 0 0 192.168.1.10:2375 192.168.1.20:51003 users:(("dockerd",pid=204,fd=9))
	 cubic bytes_acked:9999999 bytes_received:9999999
ESTAB 0 0 127.0.0.1:5000 127.0.0.1:51004 users:(("smbd",pid=202,fd=34))
	 cubic bytes_acked:9999999 bytes_received:9999999
SS
}
sockets 1000 2000 600
( sleep 1; sockets 401000 2000 200600 ) &
printf '%s\n' ACTION=network APP=atrio > "$ATRIO_STATE/backup-request"
bash "$SCRIPTS/atrio-backup" >/dev/null 2>&1
wait
check "an app on the host's network gets its own numbers" test "$(net "next(a['down'] for a in d['apps'] if a['app'] == 'home')")" -ge 150000
check "the server's services are listed" is "$(net "sorted(s['name'] for s in d['services'])")" "['casaos', 'smbd']"
check "Docker's own connections are left out" is "$(net "[s for s in d['services'] if 'docker' in s['name']]")" "[]"
check "and so are connections inside the server" test "$(net "next(s['down'] for s in d['services'] if s['name'] == 'smbd')")" -lt 1000

# Every 5 minutes too, for the last 24 hours
sockets 401000 2000 200600
alerts
sockets 701000 302000 200600
sed -i "s/^sockets_time=.*/sockets_time=$(( $(date +%s) - 300 ))/" "$ATRIO_STATE/alerts-memory"
alerts
check "the history has the host-network app's rate" is "$(apps_row home 5)" 1000
check "and the services', on their own lines" is "$(apps_row svc:smbd 5)" 1000
check "the connections are kept root-only" is "$(stat -c %a "$ATRIO_STATE/net-sockets")" 600

# ss reads nothing once: the last snapshot stays, and the next run counts from it, not from zero
before=$(cat "$ATRIO_STATE/net-sockets")
rm "$FAKE_DOCKER/sockets"
sed -i "s/^sockets_time=.*/sockets_time=$(( $(date +%s) - 300 ))/" "$ATRIO_STATE/alerts-memory"
alerts
check "a failed read keeps the last connections" is "$(cat "$ATRIO_STATE/net-sockets")" "$before"
sockets 1001000 302000 200600
sed -i "s/^sockets_time=.*/sockets_time=$(( $(date +%s) - 600 ))/" "$ATRIO_STATE/alerts-memory"
alerts
check "and the next run counts from them" is "$(apps_row home 5)" 500

# Busy: the timer's run holds the lock; the old measure is not shown as a new one
( flock 9; sleep 4 ) 9>"$ATRIO_STATE/alerts.lock" &
sleep 0.5
printf '%s\n' ACTION=network APP=atrio > "$ATRIO_STATE/backup-request"
ATRIO_LOCK_WAIT=1 bash "$SCRIPTS/atrio-backup" >/dev/null 2>&1
wait
read_status
check "a busy server says so" is "$STATE_ $MESSAGE" "error The server is busy, try again in a minute"
check "and the old measure is gone" test ! -e "$ATRIO_STATE/network.json"
finish
