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

		// The portal convention: everything under test/ is a test,
		// mirroring the source tree, with __lib__ reserved for helpers.

		exclude: ['e2e/**', 'node_modules/**', 'test/__lib__/**'],
		globals: true,
		include: ['test/**/*.{ts,tsx}'],
		setupFiles: './jest-setup.config.ts',
	},
});
