/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
	plugins: [react()],
	test: {
		css: false,
		environment: 'jsdom',
		exclude: ['e2e/**', 'node_modules/**'],
		globals: true,
		setupFiles: './src/test/setup.ts',
	},
});
