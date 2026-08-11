import {
	editorReducer,
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
