/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useReducer, useState} from 'react';

import {LoadedImage} from '../imaging/loadImage';
import {editorReducer, initialHistory} from '../state/editorReducer';
import {AdjustPanel} from './AdjustPanel';
import {BottomBar} from './BottomBar';
import {CropPanel} from './CropPanel';
import {Workspace} from './Workspace';

const IMAGE: LoadedImage = {
	blob: new Blob(),
	fileName: 'test.jpg',
	height: 800,
	pixelUrls: {coarse: 'c.png', fine: 'f.png', medium: 'm.png'},
	previewUrl: 'test.jpg',
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

	return (
		<>
			<Workspace
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={() => {}}
				onZoom={(direction) =>
					setZoom((current) => current + direction * 0.25)
				}
				onZoomFit={() => {}}
				selectedOverlayId={null}
				state={history.present}
				zoom={zoom}
			/>

			<CropPanel
				crop={history.present.crop}
				dispatch={dispatch}
				onAnnounce={() => {}}
			/>

			<AdjustPanel
				adjustments={history.present.adjustments}
				dispatch={dispatch}
				onAnnounce={() => {}}
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
				saving={false}
				zoom={zoom}
			/>
		</>
	);
}

describe('Editor workspace composition', () => {
	it('has no axe violations', async () => {
		const {container} = render(<EditorHarness />);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('exposes the crop area and all eight handles as labelled buttons', () => {
		render(<EditorHarness />);

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
		render(<EditorHarness />);

		const rightHandle = screen.getByRole('button', {
			name: 'Crop handle: right edge',
		});

		fireEvent.keyDown(rightHandle, {key: 'ArrowLeft', shiftKey: true});
		fireEvent.keyUp(rightHandle, {key: 'ArrowLeft', shiftKey: true});

		const widthInput = screen.getByLabelText('Width') as HTMLInputElement;

		expect(widthInput.value).toBe('1190');
	});

	it('commits numeric panel edits on Enter and respects aspect lock', () => {
		render(<EditorHarness />);

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
		const {container} = render(<EditorHarness />);

		expect(container.querySelector('image')).not.toHaveAttribute(
			'filter'
		);

		const slider = screen.getByLabelText('Brightness');

		fireEvent.change(slider, {target: {value: '40'}});
		fireEvent.keyUp(slider, {key: 'ArrowRight'});

		expect(container.querySelector('image')).toHaveAttribute(
			'filter',
			'url(#preview-filter)'
		);
		expect(
			container.querySelector('#preview-filter feFuncR')
		).toHaveAttribute('slope', '1.4');
	});

	it('shows the thirds grid only while a crop gesture runs', () => {
		const {container} = render(<EditorHarness />);

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
		const {container} = render(<EditorHarness />);

		expect(container.querySelector('.crop-recenter')).toBeNull();

		const widthInput = screen.getByLabelText('Width');

		fireEvent.change(widthInput, {target: {value: '400'}});
		fireEvent.keyDown(widthInput, {key: 'Enter'});

		expect(container.querySelector('.crop-recenter')).toBeInTheDocument();
	});

	it('steps an adjustment slider by 10 with shift plus arrows', () => {
		render(<EditorHarness />);

		const slider = screen.getByLabelText('Brightness');

		fireEvent.keyDown(slider, {key: 'ArrowRight', shiftKey: true});
		fireEvent.keyUp(slider, {key: 'ArrowRight', shiftKey: true});

		expect(screen.getByText('10')).toBeInTheDocument();
	});

	it('zooms with plus and minus while the workspace has focus', () => {
		render(<EditorHarness />);

		const workspace = screen.getByRole('region', {
			name: 'Image workspace',
		});

		fireEvent.keyDown(workspace, {key: '+'});

		expect(screen.getByText('75%')).toBeInTheDocument();
	});
});
