/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Generates the bundled sample image and the 20MP performance-test asset.
 * Pure Node: writes a PNG (zlib) and converts it to JPEG with macOS `sips`.
 */

import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const CRC_TABLE = new Int32Array(256).map((_, n) => {
	let c = n;

	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}

	return c;
});

function crc32(buffer) {
	let c = 0xffffffff;

	for (const byte of buffer) {
		c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	}

	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);

	length.writeUInt32BE(data.length);

	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);

	crc.writeUInt32BE(crc32(body));

	return Buffer.concat([length, body, crc]);
}

function encodePNG(width, height, pixelAt) {
	const raw = Buffer.alloc(height * (1 + width * 3));

	let offset = 0;

	for (let y = 0; y < height; y++) {
		raw[offset++] = 0;

		for (let x = 0; x < width; x++) {
			const [r, g, b] = pixelAt(x, y);

			raw[offset++] = r;
			raw[offset++] = g;
			raw[offset++] = b;
		}
	}

	const ihdr = Buffer.alloc(13);

	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, {level: 6})),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

function clamp(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * A smooth, photo-like scene: sky gradient, sun, and rolling hills.
 */
function scenePixel(x, y, width, height) {
	const nx = x / width;
	const ny = y / height;

	let r = 90 + 120 * ny;
	let g = 150 + 60 * ny;
	let b = 235 - 60 * ny;

	const sunDx = nx - 0.72;
	const sunDy = ny - 0.28;
	const sunDistance = Math.sqrt(sunDx * sunDx * 2.2 + sunDy * sunDy);

	if (sunDistance < 0.09) {
		const glow = 1 - sunDistance / 0.09;

		r += 160 * glow;
		g += 120 * glow;
		b += 40 * glow;
	}

	const horizon =
		0.62 + 0.08 * Math.sin(nx * 5.1) + 0.04 * Math.sin(nx * 13.7);

	if (ny > horizon) {
		const depth = (ny - horizon) / (1 - horizon);

		r = 60 + 40 * depth + 18 * Math.sin(nx * 40);
		g = 120 + 50 * depth + 14 * Math.sin(nx * 31 + 2);
		b = 60 + 30 * depth;
	}

	return [clamp(r), clamp(g), clamp(b)];
}

function generate(filePath, width, height) {
	const pngPath = `${filePath}.tmp.png`;

	writeFileSync(
		pngPath,
		encodePNG(width, height, (x, y) => scenePixel(x, y, width, height))
	);

	execFileSync('sips', [
		'-s',
		'format',
		'jpeg',
		'-s',
		'formatOptions',
		'85',
		pngPath,
		'--out',
		filePath,
	]);

	rmSync(pngPath);

	console.log(`Generated ${filePath} (${width}x${height})`);
}

mkdirSync(path.join(ROOT, 'public'), {recursive: true});
mkdirSync(path.join(ROOT, 'e2e/assets'), {recursive: true});

generate(path.join(ROOT, 'public/sample.jpg'), 1600, 1067);
generate(path.join(ROOT, 'e2e/assets/perf-20mp.jpg'), 5477, 3651);
