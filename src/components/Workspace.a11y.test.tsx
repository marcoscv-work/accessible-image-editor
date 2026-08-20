/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useReducer, useState} from 'react';

import {ADJUSTMENT_KEYS, RATIO_PRESETS} from '../editorConfig';
import {LoadedImage} from '../imaging/loadImage';
import {editorReducer, initialHistory} from '../state/editorReducer';
import {rotatedSize} from '../state/types';
import {renderEditor} from '../test/renderEditor';
import {AdjustPanel} from './AdjustPanel';
import {BottomBar} from './BottomBar';
import {CropPanel} from './CropPanel';
import {Workspace} from './Workspace';

const IMAGE: LoadedImage = {
	blob: new Blob(),
	fileName: 'test.jpg',
	height: 800,
	pixelUrls: {
		coarse: 'c.png',
		fine: 'f.png',
		medium: 'm.png',
		tiny: 't.png',
	},
	previewUrl: 'test.jpg',
	thumbUrl: 'thumb.jpg',
	type: 'image/jpeg',
	width: 1200,
};

/**
 * The editor content without the ClayModal chrome: jsdom cannot run the
 * modal's transition lifecycle, so the full-dialog scan happens in the
 * Playwright suite instead.
 */
function EditorHarness() {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		initialHistory(IMAGE.width, IMAGE.height)
	);
	const [zoom, setZoom] = useState(0.5);

	// Held here, as the editor holds it: the panel offers the lock and the
	// marquee obeys it.

	const [aspectLocked, setAspectLocked] = useState(false);

	return (
		<>
			<Workspace
			aspectLocked={aspectLocked}
			dispatch={dispatch}
				image={IMAGE}
				multiSelectedIds={[]}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onMultiSelectToggle={() => {}}
				onSelectOverlay={() => {}}
				onWorkspaceScroll={() => {}}
				onZoom={(direction) =>
					setZoom((current) => current + direction * 0.25)
				}
				onZoomActual={() => {}}
				onZoomFit={() => {}}
				proportional={false}
				selectedOverlayId={null}
				showCrop
				showRecenter
				state={history.present}
				zoom={zoom}
			/>

			<CropPanel
				angle={history.present.angle}
				aspectLocked={aspectLocked}
				bounds={rotatedSize(history.present)}
				crop={history.present.crop}
				dispatch={dispatch}
				onAnnounce={() => {}}
				onAspectLockedChange={setAspectLocked}
				showStraighten
			/>

			<AdjustPanel
				adjustments={history.present.adjustments}
				dispatch={dispatch}
				onAnnounce={() => {}}
				sliders={ADJUSTMENT_KEYS}
			/>

			<BottomBar
				canRedo={false}
				canUndo={history.past.length > 0}
				dispatch={dispatch}
				onAnnounce={() => {}}
				onCancel={() => {}}
				onRedo={() => {}}
				onSave={() => {}}
				onShowShortcuts={() => {}}
				onUndo={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				ratio={history.present.ratio}
				ratios={RATIO_PRESETS}
				saving={false}
				showRotate
				zoom={zoom}
			/>
		</>
	);
}

describe('Editor workspace composition', () => {
	it('has no axe violations', async () => {
		const {container} = renderEditor(<EditorHarness />);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('exposes the crop area and all eight handles as labelled buttons', () => {
		renderEditor(<EditorHarness />);

		expect(
			screen.getByRole('button', {name: 'Crop area'})
		).toBeInTheDocument();

		for (const name of [
			'Crop handle: top left corner',
			'Crop handle: top edge',
			'Crop handle: top right corner',
			'Crop handle: right edge',
			'Crop handle: bottom right corner',
			'Crop handle: bottom edge',
			'Crop handle: bottom left corner',
			'Crop handle: left edge',
		]) {
			expect(screen.getByRole('button', {name})).toBeInTheDocument();
		}
	});

	it('moves the crop area with the keyboard', () => {
		renderEditor(<EditorHarness />);

		const rightHandle = screen.getByRole('button', {
			name: 'Crop handle: right edge',
		});

		fireEvent.keyDown(rightHandle, {key: 'ArrowLeft', shiftKey: true});
		fireEvent.keyUp(rightHandle, {key: 'ArrowLeft', shiftKey: true});

		const widthInput = screen.getByLabelText('Width') as HTMLInputElement;

		expect(widthInput.value).toBe('1190');
	});

	it('commits numeric panel edits on Enter and respects aspect lock', () => {
		renderEditor(<EditorHarness />);

		const widthInput = screen.getByLabelText('Width') as HTMLInputElement;
		const heightInput = screen.getByLabelText(
			'Height'
		) as HTMLInputElement;

		fireEvent.click(screen.getByLabelText('Lock aspect ratio'));

		fireEvent.change(widthInput, {target: {value: '600'}});
		fireEvent.keyDown(widthInput, {key: 'Enter'});

		expect(widthInput.value).toBe('600');
		expect(heightInput.value).toBe('400');
	});

	it('applies the color pipeline when an adjustment slider commits', () => {
		const {container} = renderEditor(<EditorHarness />);

		expect(container.querySelector('image')).not.toHaveAttribute(
			'filter'
		);

		const slider = screen.getByLabelText('Brightness');

		fireEvent.change(slider, {target: {value: '40'}});
		fireEvent.keyUp(slider, {key: 'ArrowRight'});

		expect(container.querySelector('image')).toHaveAttribute(
			'filter',
			'url(#aie-preview-filter)'
		);
		expect(
			container.querySelector('#aie-preview-filter feFuncR')
		).toHaveAttribute('slope', '1.4');
	});

	it('paints the dim layer above the annotations', () => {
		const {container} = renderEditor(<EditorHarness />);

		const classes = [
			...(container.querySelectorAll(
				'.editor-stage > g > *'
			) as NodeListOf<Element>),
		].map((node) => node.getAttribute('class') ?? node.tagName);

		// The annotations group sits before the dim, so whatever falls
		// outside the crop looks dimmed exactly like the image under it.

		expect(classes.indexOf('crop-dim')).toBeGreaterThan(
			classes.indexOf('crop-move')
		);
		expect(classes.indexOf('crop-border')).toBeGreaterThan(
			classes.indexOf('crop-dim')
		);
	});

	it('shows the thirds grid only while a crop gesture runs', () => {
		const {container} = renderEditor(<EditorHarness />);

		const handle = screen.getByRole('button', {
			name: 'Crop handle: right edge',
		});

		expect(container.querySelectorAll('.crop-grid line')).toHaveLength(4);
		expect(container.querySelector('.crop-grid-visible')).toBeNull();

		fireEvent.keyDown(handle, {key: 'ArrowLeft'});

		expect(
			container.querySelector('.crop-grid-visible')
		).toBeInTheDocument();

		fireEvent.keyUp(handle, {key: 'ArrowLeft'});

		expect(container.querySelector('.crop-grid-visible')).toBeNull();
	});

	it('offers the recenter control only once the crop is a selection', () => {
		const {container} = renderEditor(<EditorHarness />);

		expect(container.querySelector('.crop-recenter')).toBeNull();

		const widthInput = screen.getByLabelText('Width');

		fireEvent.change(widthInput, {target: {value: '400'}});
		fireEvent.keyDown(widthInput, {key: 'Enter'});

		expect(container.querySelector('.crop-recenter')).toBeInTheDocument();
	});

	it('steps an adjustment slider by 10 with shift plus arrows', () => {
		renderEditor(<EditorHarness />);

		const slider = screen.getByLabelText('Brightness');

		fireEvent.keyDown(slider, {key: 'ArrowRight', shiftKey: true});
		fireEvent.keyUp(slider, {key: 'ArrowRight', shiftKey: true});

		expect(screen.getByText('10')).toBeInTheDocument();
	});

	it('zooms with plus and minus while the workspace has focus', () => {
		renderEditor(<EditorHarness />);

		const workspace = screen.getByRole('region', {
			name: 'Image workspace',
		});

		fireEvent.keyDown(workspace, {key: '+'});

		expect(screen.getByText('75%')).toBeInTheDocument();
	});
});

describe('the controls agree with the state from the first render', () => {
	it('shows the forced ratio as the selected option', () => {

		// AIE-002: a host narrowing the ratios to 1:1 gets an editor whose
		// state was born on 1:1, so the select's value belongs to its own
		// option list from the very first paint.

		const history = initialHistory(IMAGE.width, IMAGE.height, {
			ratios: ['1:1'],
		});

		renderEditor(
			<BottomBar
				canRedo={false}
				canUndo={false}
				dispatch={() => {}}
				onAnnounce={() => {}}
				onCancel={() => {}}
				onRedo={() => {}}
				onSave={() => {}}
				onShowShortcuts={() => {}}
				onUndo={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				ratio={history.present.ratio}
				ratios={['1:1']}
				saving={false}
				showRotate
				zoom={1}
			/>
		);

		const select = screen.getByLabelText('Ratio') as HTMLSelectElement;

		expect(select.value).toBe('1:1');
		expect(
			Array.from(select.options).map((option) => option.value)
		).toEqual(['1:1']);
	});

	it('starts a custom-plus-presets config on custom, never outside it', () => {

		// R2-004: `original` is not configured here, so it must not be
		// the state either; a select whose value is not among its own
		// options is exactly the bug the birth rule exists to prevent.

		const history = initialHistory(IMAGE.width, IMAGE.height, {
			ratios: ['custom', '16:9'],
		});

		renderEditor(
			<BottomBar
				canRedo={false}
				canUndo={false}
				dispatch={() => {}}
				onAnnounce={() => {}}
				onCancel={() => {}}
				onRedo={() => {}}
				onSave={() => {}}
				onShowShortcuts={() => {}}
				onUndo={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				ratio={history.present.ratio}
				ratios={['custom', '16:9']}
				saving={false}
				showRotate
				zoom={1}
			/>
		);

		const select = screen.getByLabelText('Ratio') as HTMLSelectElement;

		expect(select.value).toBe('custom');
		expect(
			Array.from(select.options).map((option) => option.value)
		).toEqual(['custom', '16:9']);
	});
});
