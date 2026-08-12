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
 * Deterministic value noise, so the generated sample is reproducible.
 */
function makeNoise(seed) {
	const size = 256;
	const lattice = new Float64Array(size * size);

	let state = seed;

	for (let i = 0; i < lattice.length; i++) {
		state = (state * 1664525 + 1013904223) % 4294967296;
		lattice[i] = state / 4294967296;
	}

	const at = (x, y) =>
		lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

	const smooth = (t) => t * t * (3 - 2 * t);

	return function noise(x, y) {
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);

		const tx = smooth(x - x0);
		const ty = smooth(y - y0);

		const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
		const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;

		return top * (1 - ty) + bottom * ty;
	};
}

const noise = makeNoise(20260812);

/**
 * Fractal sum of the noise: several octaves give the fine texture that
 * makes adjustments, filters and pixelation readable.
 */
function fbm(x, y, octaves = 5) {
	let value = 0;
	let amplitude = 0.5;
	let frequency = 1;

	for (let octave = 0; octave < octaves; octave++) {
		value += amplitude * noise(x * frequency, y * frequency);

		amplitude *= 0.5;
		frequency *= 2.07;
	}

	return value;
}

function mix(a, b, t) {
	return [
		a[0] + (b[0] - a[0]) * t,
		a[1] + (b[1] - a[1]) * t,
		a[2] + (b[2] - a[2]) * t,
	];
}

/**
 * Ridge height of a mountain range, in normalized units from the top.
 */
function ridge(nx, layer) {
	return (
		0.34 +
		layer * 0.07 +
		0.06 * Math.sin(nx * 6.1 + layer * 2.3) +
		0.03 * Math.sin(nx * 14.7 + layer) +
		0.05 * fbm(nx * 6 + layer * 40, layer * 7, 4)
	);
}

const CABIN = {height: 0.1, roof: 0.05, width: 0.12, x: 0.1, y: 0.66};

/**
 * A lake scene with layered ridges, procedural clouds, reflections and a
 * cabin: smooth gradients, fine texture and hard edges in one frame, which
 * is what makes every editing tool visible on the sample.
 */
function scenePixel(x, y, width, height) {
	const nx = x / width;
	const ny = y / height;

	const horizon = 0.56;

	// Above the horizon: graded sky, sun glow and fractal clouds.

	let color;

	if (ny <= horizon) {
		const t = ny / horizon;

		color = mix([64, 104, 190], [214, 176, 168], Math.pow(t, 1.3));

		const sunX = 0.71;
		const sunY = 0.3;

		const sunDistance = Math.hypot((nx - sunX) * 1.35, ny - sunY);

		if (sunDistance < 0.26) {
			const glow = Math.pow(1 - sunDistance / 0.26, 2.4);

			color = mix(color, [255, 244, 214], glow * 0.95);
		}

		const cloud = fbm(nx * 5.5, ny * 9 + 3);
		const cover = Math.max(0, cloud - 0.47) * 1.7;

		if (cover > 0) {
			const lit = mix([236, 226, 232], [122, 116, 142], 0.55 - cloud);

			color = mix(color, lit, Math.min(cover, 0.85) * (1 - t * 0.35));
		}
	}
	else {

		// Below the horizon: the lake, mirroring the sky and the ridges.

		const depth = (ny - horizon) / (1 - horizon);

		const mirrored = horizon - (ny - horizon) * 0.82;
		const mirrorT = Math.max(mirrored, 0) / horizon;

		color = mix([46, 66, 104], [150, 130, 140], Math.pow(mirrorT, 1.5));

		const ripple =
			fbm(nx * 26, mirrored * 90 + depth * 12, 3) - 0.5 + 0.06 * Math.sin(ny * 260);

		color = mix(color, [232, 214, 206], Math.max(0, ripple) * 0.5);

		color = mix(color, [18, 24, 40], depth * 0.55);
	}

	// Mountain ranges, far to near, fading into haze.

	for (let layer = 2; layer >= 0; layer--) {
		const line = ridge(nx, layer);

		if (ny > line && ny <= horizon) {
			const rock = fbm(nx * 22 + layer * 15, ny * 22, 4);

			const base = mix([70, 78, 104], [38, 44, 62], layer / 2);
			const shade = mix(base, [126, 132, 150], rock * 0.8);

			const haze = 0.34 - layer * 0.14;

			color = mix(mix(shade, [186, 176, 186], haze), color, 0);
		}
	}

	// A treeline along the far shore, for depth and fine detail.

	const treeTop =
		horizon - 0.022 - 0.016 * fbm(nx * 26, 11, 3) - 0.006 * Math.sin(nx * 120);

	if (ny > treeTop && ny <= horizon) {
		const canopy = fbm(nx * 80, ny * 60, 3);

		const forest = mix([34, 52, 42], [66, 88, 62], canopy);

		// Muted into the haze, so it reads as the far shore.

		color = mix(color, mix(forest, [172, 168, 182], 0.42), 0.9);
	}

	// Near shore: textured grass with a soft edge into the water.

	const shore = 0.76 + 0.012 * Math.sin(nx * 9.3) + 0.02 * fbm(nx * 12, 5, 3);

	if (ny > shore) {
		const blade = fbm(nx * 70, ny * 120, 4);
		const grass = mix([44, 68, 42], [104, 128, 62], blade);

		color = mix(color, grass, Math.min((ny - shore) * 40, 1));
	}

	// Cabin: hard geometry, so pixelation and redaction read clearly.

	const inCabin =
		nx > CABIN.x &&
		nx < CABIN.x + CABIN.width &&
		ny > CABIN.y &&
		ny < CABIN.y + CABIN.height;

	if (inCabin) {
		const localX = (nx - CABIN.x) / CABIN.width;
		const localY = (ny - CABIN.y) / CABIN.height;

		const plank = fbm(localX * 18, localY * 26, 3);

		color = mix([96, 74, 62], [138, 108, 86], plank);

		const window =
			(localX > 0.16 && localX < 0.42) || (localX > 0.58 && localX < 0.84);

		if (window && localY > 0.28 && localY < 0.68) {
			color = mix([248, 216, 130], [212, 158, 74], fbm(localX * 40, localY * 40, 2));
		}
	}

	const roofBase = CABIN.y;
	const roofTop = CABIN.y - CABIN.roof;

	if (ny > roofTop && ny <= roofBase) {
		const spread = (ny - roofTop) / CABIN.roof;
		const halfWidth = (CABIN.width / 2) * (0.25 + spread * 0.95);
		const center = CABIN.x + CABIN.width / 2;

		if (Math.abs(nx - center) < halfWidth) {
			color = mix([62, 52, 54], [96, 84, 84], fbm(nx * 60, ny * 60, 2));
		}
	}

	// A few birds, small and dark against the sky.

	for (const bird of [
		{scale: 0.010, x: 0.36, y: 0.16},
		{scale: 0.008, x: 0.42, y: 0.2},
		{scale: 0.007, x: 0.31, y: 0.22},
	]) {
		const dx = (nx - bird.x) / bird.scale;
		const dy = (ny - bird.y) / bird.scale;

		if (
			Math.abs(dx) < 1.6 &&
			Math.abs(dy - 0.35 * Math.abs(dx) * Math.abs(dx)) < 0.22
		) {
			color = mix(color, [46, 46, 58], 0.8);
		}
	}

	// Grain, to keep the frame from looking synthetic.

	const grain = (noise(x * 0.7, y * 0.7) - 0.5) * 7;

	return [
		clamp(color[0] + grain),
		clamp(color[1] + grain),
		clamp(color[2] + grain),
	];
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
