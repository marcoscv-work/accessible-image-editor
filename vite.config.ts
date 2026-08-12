/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({

	// GitHub Pages serves project sites under /<repo>/; the deploy
	// workflow sets BASE_PATH accordingly. Local dev stays at /.

	base: process.env.BASE_PATH ?? '/',
	plugins: [react()],
	test: {
		css: false,
		environment: 'jsdom',
		exclude: ['e2e/**', 'node_modules/**'],
		globals: true,
		setupFiles: './src/test/setup.ts',
	},
});
