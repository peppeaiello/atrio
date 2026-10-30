import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), 'VUE_APP_')
	const backend = `http://${env.VUE_APP_DEV_IP}:${env.VUE_APP_DEV_PORT}`
	const proxy = { target: backend, changeOrigin: true, ws: true }

	return {
		// Node built-ins (path, buffer, ...) used by the file browser and some dependencies
		plugins: [
			// Vue 3 compiler in Vue 2 compatibility mode, while the code is migrated
			vue({ template: { compilerOptions: { compatConfig: { MODE: 2 } } } }),
			nodePolyfills(),
		],
		resolve: {
			alias: [
				{ find: /^@\//, replacement: `${src}/` },
				{ find: /^vue$/, replacement: '@vue/compat' },
				// webpack-style "~package" imports in SCSS
				{ find: /^~(.*)$/, replacement: '$1' },
			],
			extensions: ['.mjs', '.js', '.ts', '.json', '.vue'],
		},
		define: {
			// The code still reads vue-cli style variables from process.env
			'process.env': JSON.stringify({
				...env,
				NODE_ENV: mode === 'dev' ? 'dev' : 'prod',
				BASE_URL: '/',
			}),
		},
		css: {
			preprocessorOptions: {
				scss: {
					includePaths: ['node_modules', 'src/assets'],
					additionalData: '@import "@/assets/scss/common/_variables.scss";\n@import "@/assets/scss/common/_color.scss";\n',
				},
			},
		},
		server: {
			port: 8080,
			host: '0.0.0.0',
			// Local worktrees and build output are not part of the app
			watch: { ignored: ['**/.claude/**', '**/build/**'] },
			proxy: { '/v1': proxy, '/v2': proxy },
		},
		optimizeDeps: { entries: ['index.html'] },
		build: {
			outDir: 'build/sysroot/var/lib/casaos/www',
			emptyOutDir: true,
			chunkSizeWarningLimit: 4096,
		},
	}
})
