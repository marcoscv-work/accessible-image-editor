/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * The library/shell boundary, enforced. Everything under src/ is the
 * portable component except the demo shell allowlisted below; a library
 * file may not import shell modules, bundled assets or vite-isms, so
 * the portal migration's cut line stays clean by construction.
 */

import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

const SHELL = new Set([
	'src/App.tsx',
	'src/Editor.stories.tsx',
	'src/EditorStory.tsx',
	'src/demo-theme.css',
	'src/index.html',
	'src/landing.css',
	'src/main.tsx',
	'src/vite-env.d.ts',
]);

const SHELL_PREFIXES = ['src/assets/'];

const isShell = (path) =>
	SHELL.has(path) || SHELL_PREFIXES.some((p) => path.startsWith(p));

const failures = [];

function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);

		if (statSync(path).isDirectory()) {
			walk(path);
		}
		else if (/\.(ts|tsx)$/.test(path)) {
			check(relative('.', path));
		}
	}
}

function check(path) {
	if (isShell(path)) {
		return;
	}

	const text = readFileSync(path, 'utf8');

	for (const match of text.matchAll(/from '([^']+)'|import\('([^']+)'\)/g)) {
		const spec = match[1] ?? match[2];

		if (/\.(svg|jpe?g|png|webp|gif)$/.test(spec) || spec.includes('?')) {
			failures.push(`${path}: imports a bundled asset (${spec})`);
		}

		if (spec.startsWith('.')) {
			const resolved = join(path, '..', spec).replace(/\\/g, '/');

			for (const shell of SHELL) {
				if (resolved === shell.replace(/\.tsx?$/, '')) {
					failures.push(`${path}: imports the demo shell (${spec})`);
				}
			}
		}
	}

	if (text.includes('import.meta')) {
		failures.push(`${path}: uses import.meta`);
	}
}

walk('src');

if (failures.length) {
	console.error('Library/shell boundary violations:\n');

	for (const failure of failures) {
		console.error(`  ${failure}`);
	}

	process.exit(1);
}

console.log('boundary clean: the library imports no shell, assets or vite-isms');
