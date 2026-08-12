/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Builds the 20MP asset the performance spec measures against, by
 * upscaling the bundled sample. The sample itself is a committed photo, so
 * this is the only generated image (and it stays out of the repository).
 */

import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SAMPLE = path.join(ROOT, 'public/sample.jpg');
const PERF_ASSET = path.join(ROOT, 'e2e/assets/perf-20mp.jpg');

const TARGET_PIXELS = 20_000_000;

function dimension(name) {
	const output = execFileSync('sips', ['-g', name, SAMPLE], {
		encoding: 'utf8',
	});

	return Number(output.trim().split(/\s+/).pop());
}

mkdirSync(path.dirname(PERF_ASSET), {recursive: true});

const width = dimension('pixelWidth');
const height = dimension('pixelHeight');

const scaledWidth = Math.round(Math.sqrt((TARGET_PIXELS * width) / height));

execFileSync('sips', [
	'--resampleWidth',
	String(scaledWidth),
	'-s',
	'format',
	'jpeg',
	'-s',
	'formatOptions',
	'85',
	SAMPLE,
	'--out',
	PERF_ASSET,
]);

console.log(
	`Generated ${PERF_ASSET} (${scaledWidth}x${Math.round(
		(scaledWidth * height) / width
	)})`
);
