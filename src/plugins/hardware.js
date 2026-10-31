// Machine details for the Hardware panel, read from the files Linux exposes in /proc and /sys
// through the CasaOS file API: nothing to install on the server. Sensors come from hwmon, so
// fans, voltages and power show up on machines whose chips report them and are left out elsewhere.

const HWMON = '/sys/class/hwmon'
const DMI = '/sys/class/dmi/id'
const KINDS = { temp: 'temp', fan: 'fan', in: 'voltage', power: 'power', curr: 'current' }

// Friendly names for the usual hwmon drivers, matched without the "_0" suffix newer kernels add
const DEVICES = {
	coretemp: 'Processor',
	k10temp: 'Processor',
	zenpower: 'Processor',
	cpu_thermal: 'Processor',
	acpitz: 'Motherboard (ACPI)',
	pch_cannonlake: 'Chipset',
	nvme: 'NVMe drive',
	drivetemp: 'Disk',
	amdgpu: 'Graphics',
	nouveau: 'Graphics',
	i915: 'Graphics',
	iwlwifi: 'Wi-Fi card',
	BAT0: 'Battery',
}

async function read(api, path) {
	try {
		const res = await api.file.getContent(path)
		return res.data.success === 200 ? String(res.data.data ?? '').trim() : null
	}
	catch (e) {
		return null
	}
}

async function list(api, path) {
	try {
		const res = await api.folder.getList(path)
		return res.data.success === 200 ? (res.data.data?.content || []).map((entry) => entry.name) : []
	}
	catch (e) {
		return []
	}
}

function number(text) {
	const value = Number(text)
	return text !== null && text !== '' && Number.isFinite(value) ? value : null
}

// "key : value" lines, as in /proc/cpuinfo and /proc/meminfo
function fields(text) {
	const out = {}
	for (const line of (text || '').split('\n')) {
		const at = line.indexOf(':')
		if (at > 0) {
			const key = line.slice(0, at).trim()
			if (!(key in out)) out[key] = line.slice(at + 1).trim()
		}
	}
	return out
}

function osName(text) {
	const match = /^PRETTY_NAME="?([^"\n]*)"?/m.exec(text || '')
	return match ? match[1] : ''
}

function deviceName(raw) {
	const base = raw.replace(/_\d+$/, '')
	return DEVICES[base] || DEVICES[base.split('_')[0]] || base
}

/** Everything that does not change while the machine runs. */
export async function readStatic(api) {
	const [vendor, product, boardVendor, board, biosVendor, biosVersion, biosDate, os, kernel, hostname, cpuinfo, maxFreq] = await Promise.all([
		read(api, `${DMI}/sys_vendor`),
		read(api, `${DMI}/product_name`),
		read(api, `${DMI}/board_vendor`),
		read(api, `${DMI}/board_name`),
		read(api, `${DMI}/bios_vendor`),
		read(api, `${DMI}/bios_version`),
		read(api, `${DMI}/bios_date`),
		read(api, '/etc/os-release'),
		read(api, '/proc/sys/kernel/osrelease'),
		read(api, '/proc/sys/kernel/hostname'),
		read(api, '/proc/cpuinfo'),
		read(api, '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq'),
	])
	const cpu = fields(cpuinfo)
	const threads = (cpuinfo || '').split('\n').filter((line) => /^processor\s*:/.test(line)).length
	// Raspberry Pi and other ARM boards name the model in /proc/cpuinfo instead of DMI
	const machine = [vendor, product].filter(Boolean).join(' ') || cpu.Model || ''
	return {
		machine,
		board: [boardVendor, board].filter(Boolean).join(' '),
		bios: [biosVendor, biosVersion, biosDate && `(${biosDate})`].filter(Boolean).join(' '),
		os: osName(os),
		kernel: kernel || '',
		hostname: hostname || '',
		cpu: {
			model: cpu['model name'] || cpu.Hardware || cpu['cpu model'] || '',
			cores: number(cpu['cpu cores']) || threads,
			threads,
			cache: cpu['cache size'] || '',
			maxMHz: number(maxFreq) ? Math.round(number(maxFreq) / 1000) : null,
		},
	}
}

/** The hwmon sensors, grouped by device; values are filled in by readLive. */
export async function discoverSensors(api) {
	const devices = await list(api, HWMON)
	const groups = await Promise.all(devices.map(async (dir) => {
		const path = `${HWMON}/${dir}`
		const [name, files] = await Promise.all([read(api, `${path}/name`), list(api, path)])
		const raw = name || dir
		let label = deviceName(raw)
		// NVMe and disks: the model says which drive it is
		if (/^(nvme|drivetemp)/.test(raw)) {
			const model = await read(api, `${path}/device/model`)
			if (model) label = `${label} · ${model}`
		}
		const inputs = files.filter((file) => /^(temp|fan|in|power|curr)\d+_(input|average)$/.test(file))
		const sensors = await Promise.all(inputs.map(async (file) => {
			const [, type, index] = /^([a-z]+)(\d+)_/.exec(file)
			const has = (suffix) => files.includes(`${type}${index}_${suffix}`)
			const [text, max, crit] = await Promise.all([
				has('label') ? read(api, `${path}/${type}${index}_label`) : null,
				type === 'temp' && has('max') ? read(api, `${path}/${type}${index}_max`) : null,
				type === 'temp' && has('crit') ? read(api, `${path}/${type}${index}_crit`) : null,
			])
			return {
				id: `${dir}/${file}`,
				kind: KINDS[type],
				// No label from the driver: the panel names it after its kind ("Temperature", "Fan 2")
				label: text || '',
				index: Number(index),
				path: `${path}/${file}`,
				max: number(max) ? number(max) / 1000 : null,
				crit: number(crit) ? number(crit) / 1000 : null,
				value: null,
			}
		}))
		return { id: dir, name: label, sensors }
	}))
	// Processor first, then the rest of the board, then add-on devices
	const rank = (group) => {
		const order = ['Processor', 'Chipset', 'Motherboard (ACPI)', 'NVMe drive', 'Disk', 'Graphics']
		const at = order.indexOf(group.name.split(' · ')[0])
		return at === -1 ? order.length : at
	}
	return groups.filter((group) => group.sensors.length).sort((a, b) => rank(a) - rank(b))
}

// hwmon units: millidegrees, RPM, millivolts, microwatts, milliamps
const SCALE = { temp: 1000, fan: 1, voltage: 1000, power: 1000000, current: 1000 }

/** The values that change: sensors, frequency, memory, uptime, load. */
export async function readLive(api, groups, threads) {
	const sensors = groups.flatMap((group) => group.sensors)
	const freqPaths = Array.from({ length: threads || 0 }, (_, i) => `/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`)
	const [values, freqs, meminfo, uptime, loadavg] = await Promise.all([
		Promise.all(sensors.map((sensor) => read(api, sensor.path))),
		Promise.all(freqPaths.map((path) => read(api, path))),
		read(api, '/proc/meminfo'),
		read(api, '/proc/uptime'),
		read(api, '/proc/loadavg'),
	])
	sensors.forEach((sensor, i) => {
		const value = number(values[i])
		sensor.value = value === null ? null : value / SCALE[sensor.kind]
	})
	const mhz = freqs.map(number).filter((value) => value !== null).map((value) => value / 1000)
	const mem = fields(meminfo)
	const kb = (key) => (number((mem[key] || '').replace(/\s*kB$/, '')) || 0) * 1024
	return {
		avgMHz: mhz.length ? Math.round(mhz.reduce((a, b) => a + b, 0) / mhz.length) : null,
		memory: {
			total: kb('MemTotal'),
			used: kb('MemTotal') - kb('MemAvailable'),
			swapTotal: kb('SwapTotal'),
			swapUsed: kb('SwapTotal') - kb('SwapFree'),
		},
		uptime: number((uptime || '').split(' ')[0]),
		load: (loadavg || '').split(' ').slice(0, 3).map(number),
	}
}
