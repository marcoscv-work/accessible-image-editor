/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {describe, expect, it} from 'vitest';

import {editorReducer, initialHistory} from '../state/editorReducer';
import {
	ArrowOverlay,
	EmojiOverlay,
	ImageOverlay,
	Overlay,
	RedactOverlay,
	ShapeOverlay,
	StrokeOverlay,
	TextOverlay,
} from '../state/types';
import {coverScale} from './geometry';
import {applyToPoint, imageMatrix, invert, multiply} from './overlayTransform';

/**
 * AIE-001: the annotations turn with the picture. The space here is
 * 1600x1000, so after one clockwise quarter turn a display point (x, y)
 * lands on (1000 - y, x) in the 1000x1600 space.
 */

const RECT: ShapeOverlay = {
	color: '#0b5fff',
	height: 100,
	id: 'shape-1',
	kind: 'shape',
	width: 300,
	x: 100,
	y: 200,
};

const REDACT: RedactOverlay = {
	height: 160,
	id: 'redact-1',
	kind: 'redact',
	level: 'fine',
	width: 360,
	x: 260,
	y: 700,
};

const PICTURE: ImageOverlay = {
	description: 'badge',
	height: 100,
	id: 'image-1',
	kind: 'image',
	src: 'data:image/png;base64,AAAA',
	width: 100,
	x: 200,
	y: 200,
};

const TEXT: TextOverlay = {
	color: '#ffffff',
	fontFamily: 'sans-serif',
	fontSize: 50,
	id: 'text-1',
	kind: 'text',
	text: 'Hello',
	x: 400,
	y: 500,
};

const EMOJI: EmojiOverlay = {
	character: '⭐',
	id: 'emoji-1',
	kind: 'emoji',
	name: 'star',
	size: 120,
	x: 800,
	y: 300,
};

const ARROW: ArrowOverlay = {
	color: '#0b5fff',
	dx: 200,
	dy: -100,
	head: 'filled',
	id: 'arrow-1',
	kind: 'arrow',
	thickness: 6,
	x: 300,
	y: 400,
};

const STROKE: StrokeOverlay = {
	color: '#0b5fff',
	id: 'stroke-1',
	kind: 'stroke',
	points: [0, 0, 100, 40, 200, 0],
	smooth: true,
	width: 6,
	x: 500,
	y: 600,
};

const ALL: Overlay[] = [RECT, REDACT, PICTURE, TEXT, EMOJI, ARROW, STROKE];

function withOverlays(overlays: Overlay[]) {
	let history = initialHistory(1600, 1000);

	for (const overlay of overlays) {
		history = editorReducer(history, {overlay, type: 'add-overlay'});
	}

	return history;
}

function rotate(history: ReturnType<typeof initialHistory>, times: number) {
	let next = history;

	for (let turn = 0; turn < times; turn++) {
		next = editorReducer(next, {type: 'rotate-90'});
	}

	return next;
}

describe('rotate-90 carries the annotations', () => {
	it('maps a rectangle exactly, folding the turn into its box', () => {
		const rotated = rotate(withOverlays([RECT]), 1).present
			.overlays[0] as ShapeOverlay;

		// Corners (100,200)-(400,300) land on x' = 1000-(y+h) = 700,
		// y' = x = 100, with the sides swapped and no rotation field.

		expect(rotated).toMatchObject({
			height: 300,
			width: 100,
			x: 700,
			y: 100,
		});

		expect(rotated.rotation).toBeUndefined();
	});

	it('keeps a redaction over the same pixels', () => {
		const rotated = rotate(withOverlays([REDACT]), 1).present
			.overlays[0] as RedactOverlay;

		expect(rotated).toMatchObject({
			height: 360,
			width: 160,
			x: 1000 - (700 + 160),
			y: 260,
		});
	});

	it('turns a picture through its rotation field, not its box', () => {
		const rotated = rotate(withOverlays([PICTURE]), 1).present
			.overlays[0] as ImageOverlay;

		// The centre (250,250) lands on (750,250); the box keeps its own
		// proportions and the turn lives in `rotation`, because the
		// picture's content has an orientation of its own.

		expect(rotated).toMatchObject({
			height: 100,
			rotation: 90,
			width: 100,
			x: 700,
			y: 200,
		});
	});

	it('rotates an arrow by its vector', () => {
		const rotated = rotate(withOverlays([ARROW]), 1).present
			.overlays[0] as ArrowOverlay;

		// Tail (300,400) → (600,300); vector (200,-100) → (100,200).

		expect(rotated).toMatchObject({dx: 100, dy: 200, x: 600, y: 300});
	});

	it('rotates an emoji about its centre', () => {
		const rotated = rotate(withOverlays([EMOJI]), 1).present
			.overlays[0] as EmojiOverlay;

		expect(rotated).toMatchObject({rotation: 90, size: 120, x: 700, y: 800});
	});

	it('maps every stroke point and rebases the origin', () => {
		const rotated = rotate(withOverlays([STROKE]), 1).present
			.overlays[0] as StrokeOverlay;

		// Absolute points (500,600),(600,640),(700,600) land on
		// (400,500),(360,600),(400,700): new box origin (360,500).

		expect(rotated.x).toBe(360);
		expect(rotated.y).toBe(500);
		expect(rotated.points).toEqual([40, 0, 0, 100, 40, 200]);
	});

	it('returns every kind to itself after four turns', () => {
		const start = withOverlays(ALL).present.overlays;
		const full = rotate(withOverlays(ALL), 4).present.overlays;

		for (let index = 0; index < start.length; index++) {
			const before = start[index] as unknown as Record<string, unknown>;
			const after = full[index] as unknown as Record<string, unknown>;

			for (const key of Object.keys(before)) {
				const original = before[key];
				const returned = after[key];

				if (typeof original === 'number') {
					expect(returned as number).toBeCloseTo(original, 1);
				}
				else if (Array.isArray(original)) {
					(original as number[]).forEach((value, at) =>
						expect((returned as number[])[at]).toBeCloseTo(
							value,
							1
						)
					);
				}
				else {
					expect(returned).toEqual(original);
				}
			}
		}
	});

	it('stays exact with the picture flipped', () => {
		let history = withOverlays([REDACT]);

		history = editorReducer(history, {type: 'flip-horizontal'});

		const flipped = history.present.overlays[0] as RedactOverlay;

		const rotated = rotate(history, 4).present.overlays[0] as RedactOverlay;

		expect(rotated.x).toBeCloseTo(flipped.x, 1);
		expect(rotated.y).toBeCloseTo(flipped.y, 1);
		expect(rotated.width).toBeCloseTo(flipped.width, 1);
		expect(rotated.height).toBeCloseTo(flipped.height, 1);
	});
});

describe('straighten carries the redactions and only them', () => {
	it('locks a redaction to its content and leaves a caption on the frame', () => {
		let history = withOverlays([REDACT, TEXT]);

		history = editorReducer(history, {angle: 10, type: 'set-angle'});

		const [redact, text] = history.present.overlays as [
			RedactOverlay,
			TextOverlay,
		];

		// The caption belongs to the frame: untouched.

		expect(text).toEqual(TEXT);

		// The redaction follows the pixels: through the same rotation and
		// cover-scale the stage applies.

		const scale = coverScale(1600, 1000, 10);

		expect(redact.width).toBeCloseTo(360 * scale, 0);
		expect(redact.height).toBeCloseTo(160 * scale, 0);
		expect(redact.rotation).toBeCloseTo(10, 1);

		const mapping = multiply(
			imageMatrix({
				angle: 10,
				flipHorizontal: false,
				rotation: 0,
				sourceHeight: 1000,
				sourceWidth: 1600,
			}),
			invert(
				imageMatrix({
					angle: 0,
					flipHorizontal: false,
					rotation: 0,
					sourceHeight: 1000,
					sourceWidth: 1600,
				})
			)
		);

		const [expectedX, expectedY] = applyToPoint(
			mapping,
			260 + 360 / 2,
			700 + 160 / 2
		);

		expect(redact.x + redact.width / 2).toBeCloseTo(expectedX, 0);
		expect(redact.y + redact.height / 2).toBeCloseTo(expectedY, 0);
	});

	it('transforms once per gesture, from the angle it started at', () => {
		let history = withOverlays([REDACT]);

		// A slider drag: transients touch nothing, the commit carries the
		// redaction from the gesture's base in one exact step.

		history = editorReducer(history, {
			angle: 4,
			transient: true,
			type: 'set-angle',
		});
		history = editorReducer(history, {
			angle: 8,
			transient: true,
			type: 'set-angle',
		});

		expect(history.present.overlays[0]).toEqual(REDACT);

		history = editorReducer(history, {angle: 8, type: 'set-angle'});

		const committed = history.present.overlays[0] as RedactOverlay;

		expect(committed.rotation).toBeCloseTo(8, 1);

		// And undoing restores both the angle and the redaction.

		history = editorReducer(history, {type: 'undo'});

		expect(history.present.angle).toBe(0);
		expect(history.present.overlays[0]).toEqual(REDACT);
	});

	it('does nothing when the gesture lands where it started', () => {
		let history = withOverlays([REDACT]);

		history = editorReducer(history, {
			angle: 6,
			transient: true,
			type: 'set-angle',
		});
		history = editorReducer(history, {angle: 0, type: 'set-angle'});

		expect(history.present.overlays[0]).toEqual(REDACT);
	});
});
