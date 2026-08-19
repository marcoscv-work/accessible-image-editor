/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {
	HISTORY_LIMIT,
	editorReducer,
	initialEditState,
	initialHistory,
	redoLabel,
	undoLabel,
} from './editorReducer';
import {EditorHistory, MIN_CROP_SIZE} from './types';

const WIDTH = 1600;
const HEIGHT = 1000;

function history(): EditorHistory {
	return initialHistory(WIDTH, HEIGHT);
}

describe('editorReducer', () => {
	it('starts with a full-image crop and the original ratio', () => {
		const {present} = history();

		expect(present.crop).toEqual({
			height: HEIGHT,
			width: WIDTH,
			x: 0,
			y: 0,
		});
		expect(present.ratio).toBe('original');
		expect(present.overlays).toEqual([]);
	});

	it('clamps the crop to the image bounds and minimum size', () => {
		const next = editorReducer(history(), {
			crop: {height: 5000, width: -20, x: -50, y: 900},
			type: 'set-crop',
		});

		const {crop} = next.present;

		expect(crop.width).toBe(MIN_CROP_SIZE);
		expect(crop.x).toBeGreaterThanOrEqual(0);
		expect(crop.y + crop.height).toBeLessThanOrEqual(HEIGHT);
	});

	it('marks the ratio as custom after a free crop edit', () => {
		const next = editorReducer(history(), {
			crop: {height: 500, width: 500, x: 10, y: 10},
			type: 'set-crop',
		});

		expect(next.present.ratio).toBe('custom');
	});

	it('applies a centered crop for a ratio preset', () => {
		const next = editorReducer(history(), {
			ratio: '1:1',
			type: 'set-ratio',
		});

		const {crop} = next.present;

		expect(crop.width).toBe(crop.height);
		expect(crop.height).toBe(HEIGHT);
		expect(crop.x).toBe((WIDTH - HEIGHT) / 2);
	});

	it('restores the full crop for the original ratio preset', () => {
		let state = editorReducer(history(), {
			crop: {height: 300, width: 300, x: 0, y: 0},
			type: 'set-crop',
		});

		state = editorReducer(state, {ratio: 'original', type: 'set-ratio'});

		expect(state.present.crop).toEqual({
			height: HEIGHT,
			width: WIDTH,
			x: 0,
			y: 0,
		});
	});

	it('swaps dimensions and resets the crop on rotation', () => {
		const next = editorReducer(history(), {type: 'rotate-90'});

		expect(next.present.rotation).toBe(90);
		expect(next.present.crop).toEqual({
			height: WIDTH,
			width: HEIGHT,
			x: 0,
			y: 0,
		});
	});

	it('collapses a transient gesture into a single undo step', () => {
		let state = history();

		for (let i = 1; i <= 5; i++) {
			state = editorReducer(state, {
				crop: {height: 500, width: 500, x: i * 10, y: 0},
				transient: true,
				type: 'set-crop',
			});
		}

		state = editorReducer(state, {
			crop: state.present.crop,
			type: 'set-crop',
		});

		expect(state.past).toHaveLength(1);
		expect(state.present.crop.x).toBe(50);

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.crop.x).toBe(0);
		expect(state.present.crop.width).toBe(WIDTH);
	});

	it('ignores no-op commits so blurs never pollute the history', () => {
		let state = editorReducer(history(), {
			crop: {height: 500, width: 800, x: 0, y: 0},
			type: 'set-crop',
		});

		state = editorReducer(state, {
			crop: {height: 500, width: 800, x: 0, y: 0},
			type: 'set-crop',
		});

		state = editorReducer(state, {
			key: 'brightness',
			type: 'set-adjustment',
			value: 0,
		});

		expect(state.past).toHaveLength(1);
	});

	it('reverts an uncommitted gesture on undo', () => {
		let state = editorReducer(history(), {
			crop: {height: 500, width: 500, x: 40, y: 0},
			transient: true,
			type: 'set-crop',
		});

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.crop.width).toBe(WIDTH);
		expect(state.past).toHaveLength(0);
	});

	it('duplicates an overlay right above the original with an offset', () => {
		const overlay = {
			color: '#ffffff',
			fontFamily: 'sans-serif',
			fontSize: 48,
			id: 'text-1',
			kind: 'text' as const,
			text: 'Hello',
			x: 100,
			y: 100,
		};

		let state = editorReducer(history(), {overlay, type: 'add-overlay'});

		state = editorReducer(state, {
			overlay: {...overlay, id: 'text-2', text: 'World'},
			type: 'add-overlay',
		});

		state = editorReducer(state, {
			id: 'text-1',
			newId: 'text-1-copy',
			type: 'duplicate-overlay',
		});

		expect(state.present.overlays.map((item) => item.id)).toEqual([
			'text-1',
			'text-1-copy',
			'text-2',
		]);

		// Offset: 2% of the smaller image side (1000 x 0.02 = 20).

		expect(state.present.overlays[1]).toMatchObject({x: 120, y: 120});
	});

	it('collapses a straighten gesture into one undo step', () => {
		let state = history();

		for (const angle of [2, 4, 6]) {
			state = editorReducer(state, {
				angle,
				transient: true,
				type: 'set-angle',
			});
		}

		state = editorReducer(state, {angle: 6, type: 'set-angle'});

		expect(state.present.angle).toBe(6);
		expect(state.past).toHaveLength(1);

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.angle).toBe(0);
	});

	it('round-trips undo and redo with labels', () => {
		let state = editorReducer(history(), {type: 'rotate-90'});

		expect(undoLabel(state)).toBe('rotation');

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.rotation).toBe(0);
		expect(redoLabel(state)).toBe('rotation');

		state = editorReducer(state, {type: 'redo'});

		expect(state.present.rotation).toBe(90);
		expect(undoLabel(state)).toBe('rotation');
	});

	it('clears the redo stack on a new edit', () => {
		let state = editorReducer(history(), {type: 'rotate-90'});

		state = editorReducer(state, {type: 'undo'});
		state = editorReducer(state, {
			crop: {height: 400, width: 400, x: 0, y: 0},
			type: 'set-crop',
		});

		expect(state.future).toHaveLength(0);
		expect(redoLabel(state)).toBeNull();
	});

	it('updates and resets adjustments', () => {
		let state = editorReducer(history(), {
			key: 'brightness',
			type: 'set-adjustment',
			value: 40,
		});

		expect(state.present.adjustments.brightness).toBe(40);

		state = editorReducer(state, {type: 'reset-adjustments'});

		expect(state.present.adjustments.brightness).toBe(0);
	});

	it('adds, updates, reorders, and removes overlays', () => {
		const overlay = {
			color: '#ffffff',
			fontFamily: 'sans-serif',
			fontSize: 48,
			id: 'text-1',
			kind: 'text' as const,
			text: 'Hello',
			x: 100,
			y: 100,
		};

		const second = {...overlay, id: 'text-2', text: 'World'};

		let state = editorReducer(history(), {
			overlay,
			type: 'add-overlay',
		});

		state = editorReducer(state, {overlay: second, type: 'add-overlay'});

		state = editorReducer(state, {
			id: 'text-1',
			patch: {x: 200},
			type: 'update-overlay',
		});

		expect(state.present.overlays[0]).toMatchObject({id: 'text-1', x: 200});

		state = editorReducer(state, {
			direction: 1,
			id: 'text-1',
			type: 'move-overlay-layer',
		});

		expect(state.present.overlays.map((item) => item.id)).toEqual([
			'text-2',
			'text-1',
		]);

		state = editorReducer(state, {id: 'text-1', type: 'remove-overlay'});

		expect(state.present.overlays).toHaveLength(1);
	});
});

describe('flip-horizontal', () => {
	const start = () => initialHistory(1000, 600);

	it('mirrors the composition and returns on the second flip', () => {
		const once = editorReducer(start(), {type: 'flip-horizontal'});

		expect(once.present.flipHorizontal).toBe(true);

		const twice = editorReducer(once, {type: 'flip-horizontal'});

		expect(twice.present.flipHorizontal).toBe(false);
	});

	it('carries the crop, so the frame keeps its subject', () => {
		const cropped = editorReducer(start(), {
			crop: {height: 200, width: 300, x: 100, y: 50},
			type: 'set-crop',
		});

		const flipped = editorReducer(cropped, {type: 'flip-horizontal'});

		// 1000 - 100 - 300

		expect(flipped.present.crop).toEqual({
			height: 200,
			width: 300,
			x: 600,
			y: 50,
		});

		const back = editorReducer(flipped, {type: 'flip-horizontal'});

		expect(back.present.crop).toEqual(cropped.present.crop);
	});

	it('carries the annotations, so a redaction keeps what it covers', () => {
		const withRedaction = editorReducer(start(), {
			overlay: {
				height: 80,
				id: 'redact-1',
				kind: 'redact',
				level: 'fine',
				width: 120,
				x: 200,
				y: 40,
			},
			type: 'add-overlay',
		});

		const flipped = editorReducer(withRedaction, {
			type: 'flip-horizontal',
		});

		// 1000 - 200 - 120

		expect(flipped.present.overlays[0]).toMatchObject({x: 680, y: 40});

		const back = editorReducer(flipped, {type: 'flip-horizontal'});

		expect(back.present.overlays[0]).toMatchObject({x: 200, y: 40});
	});

	it('is one undoable step', () => {
		const flipped = editorReducer(start(), {type: 'flip-horizontal'});
		const undone = editorReducer(flipped, {type: 'undo'});

		expect(undone.present.flipHorizontal).toBe(false);
	});
});

describe('set-frame', () => {
	it('merges what changed and leaves the rest of the frame alone', () => {
		const framed = editorReducer(history(), {
			frame: {kind: 'mat'},
			type: 'set-frame',
		});

		const sized = editorReducer(framed, {
			frame: {size: 10},
			type: 'set-frame',
		});

		expect(sized.present.frame).toEqual({
			color: '#ffffff',
			kind: 'mat',
			offset: 0,
			overAnnotations: true,
			size: 10,
		});
	});

	it('ignores a change that changes nothing', () => {
		const framed = editorReducer(history(), {
			frame: {kind: 'mat'},
			type: 'set-frame',
		});

		expect(
			editorReducer(framed, {frame: {kind: 'mat'}, type: 'set-frame'})
		).toBe(framed);
	});

	it('is undoable, and a slider drag is a single step', () => {
		let state = editorReducer(history(), {
			frame: {kind: 'mat'},
			type: 'set-frame',
		});

		for (const size of [5, 6, 7, 8]) {
			state = editorReducer(state, {
				frame: {size},
				transient: true,
				type: 'set-frame',
			});
		}

		state = editorReducer(state, {frame: {size: 8}, type: 'set-frame'});

		expect(state.present.frame.size).toBe(8);
		expect(undoLabel(state)).toBe('frame change');

		const undone = editorReducer(state, {type: 'undo'});

		expect(undone.present.frame.size).toBe(4);
		expect(undone.present.frame.kind).toBe('mat');
	});

	it('moves under the annotations when asked', () => {
		let state = editorReducer(history(), {
			frame: {kind: 'mat'},
			type: 'set-frame',
		});

		state = editorReducer(state, {
			frame: {overAnnotations: false},
			type: 'set-frame',
		});

		expect(state.present.frame.overAnnotations).toBe(false);

		// Still the same frame, only on the other side of the annotations.

		expect(state.present.frame.kind).toBe('mat');
	});

	it('survives a crop, because it is intent rather than geometry', () => {
		const framed = editorReducer(history(), {
			frame: {kind: 'polaroid'},
			type: 'set-frame',
		});

		const cropped = editorReducer(framed, {
			crop: {height: 400, width: 400, x: 100, y: 100},
			type: 'set-crop',
		});

		expect(cropped.present.frame.kind).toBe('polaroid');
	});
});

describe('the initial state is born inside the configuration', () => {
	it('starts every property on its neutral when nothing narrows it', () => {
		const state = initialEditState(WIDTH, HEIGHT);

		expect(state.filter).toBe('none');
		expect(state.frame.kind).toBe('none');
		expect(state.ratio).toBe('original');
	});

	it('keeps the neutral when the configuration allows it', () => {
		const state = initialEditState(WIDTH, HEIGHT, {
			filters: ['none', 'sepia'],
			frames: ['none', 'mat'],
			ratios: ['original', '1:1'],
		});

		expect(state.filter).toBe('none');
		expect(state.frame.kind).toBe('none');
		expect(state.ratio).toBe('original');
	});

	it('starts on the first allowed value when the neutral is gone', () => {

		// The review's case: a host offering only sepia must not open an
		// editor whose gallery shows sepia but whose state says none.

		const state = initialEditState(WIDTH, HEIGHT, {
			filters: ['sepia'],
			frames: ['mat'],
		});

		expect(state.filter).toBe('sepia');
		expect(state.frame.kind).toBe('mat');
	});

	it('applies a forced ratio to the crop it starts with', () => {
		const state = initialEditState(WIDTH, HEIGHT, {ratios: ['1:1']});

		expect(state.ratio).toBe('1:1');

		// A centered square in 1600x1000: the crop the select claims.

		expect(state.crop).toEqual({
			height: HEIGHT,
			width: HEIGHT,
			x: (WIDTH - HEIGHT) / 2,
			y: 0,
		});
	});

	it('treats custom as freedom enough to keep the full image', () => {
		const state = initialEditState(WIDTH, HEIGHT, {
			ratios: ['custom', '16:9'],
		});

		// The full image is a legal custom crop, so nothing forces the
		// 16:9 window on someone who was offered a free hand.

		expect(state.ratio).toBe('original');
		expect(state.crop).toEqual({height: HEIGHT, width: WIDTH, x: 0, y: 0});
	});

	it('keeps the neutral when a section is switched off entirely', () => {

		// Empty lists mean no control renders, and no control can
		// disagree with a state it does not show.

		const state = initialEditState(WIDTH, HEIGHT, {
			filters: [],
			frames: [],
			ratios: [],
		});

		expect(state.filter).toBe('none');
		expect(state.frame.kind).toBe('none');
		expect(state.ratio).toBe('original');
	});
});

describe('cancel-gesture', () => {
	it('reverts an open transient gesture without a history entry', () => {
		let state = history();

		state = editorReducer(state, {
			crop: {height: 400, width: 400, x: 10, y: 10},
			transient: true,
			type: 'set-crop',
		});
		state = editorReducer(state, {
			crop: {height: 300, width: 300, x: 20, y: 20},
			transient: true,
			type: 'set-crop',
		});

		const pastBefore = state.past.length;

		state = editorReducer(state, {type: 'cancel-gesture'});

		// Back to the base, nothing recorded, nothing pending.

		expect(state.present.crop).toEqual({
			height: HEIGHT,
			width: WIDTH,
			x: 0,
			y: 0,
		});
		expect(state.past.length).toBe(pastBefore);
		expect(state.pendingBase).toBeUndefined();

		// And the next commit is its own gesture, not the absorbed tail
		// of the cancelled one.

		state = editorReducer(state, {
			crop: {height: 500, width: 500, x: 0, y: 0},
			type: 'set-crop',
		});

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.crop).toEqual({
			height: HEIGHT,
			width: WIDTH,
			x: 0,
			y: 0,
		});
	});

	it('does nothing when no gesture is open', () => {
		const state = history();

		expect(editorReducer(state, {type: 'cancel-gesture'})).toBe(state);
	});
});

describe('the undo stack is bounded', () => {
	it('drops the oldest entry past the limit', () => {
		let state = history();

		for (let step = 1; step <= HISTORY_LIMIT + 5; step++) {
			state = editorReducer(state, {
				key: 'brightness',
				type: 'set-adjustment',
				value: step % 100,
			});
		}

		expect(state.past.length).toBe(HISTORY_LIMIT);

		// The newest edits are all still there: undoing one step lands
		// on the previous value, not on some collapsed average.

		state = editorReducer(state, {type: 'undo'});

		expect(state.present.adjustments.brightness).toBe(
			(HISTORY_LIMIT + 4) % 100
		);
	});
});
