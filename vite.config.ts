/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({

	// GitHub Pages serves project sites under /<repo>/, and the editor now
	// lives under /demo/ because the website took the root. The deploy
	// workflow sets BASE_PATH accordingly; local dev stays at /.

	base: process.env.BASE_PATH ?? '/',
	build: {
		outDir: process.env.BUILD_OUT_DIR ?? 'dist',
	},
	plugins: [react()],
	test: {
		css: false,
		environment: 'jsdom',
		exclude: ['e2e/**', 'node_modules/**'],
		globals: true,
		setupFiles: './src/test/setup.ts',
	},
});
