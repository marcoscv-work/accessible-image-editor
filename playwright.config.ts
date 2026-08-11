import {defineConfig} from '@playwright/test';

export default defineConfig({
	projects: [{name: 'chromium', use: {browserName: 'chromium'}}],
	testDir: './e2e',
	timeout: 60_000,
	use: {
		baseURL: 'http://localhost:5273',
	},
	webServer: {
		command: 'npm run dev -- --port 5273 --strictPort',
		reuseExistingServer: !process.env.CI,
		url: 'http://localhost:5273',
	},
});
