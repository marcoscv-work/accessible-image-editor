/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useReducer, useState} from 'react';

import {LoadedImage} from '../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
} from '../state/editorReducer';
import {rotatedSize} from '../state/types';
import {AnnotatePanel} from './AnnotatePanel';
import {FilterGallery} from './FilterGallery';
import {LayersPanel} from './LayersPanel';
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

function AnnotationHarness() {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		initialHistory(IMAGE.width, IMAGE.height)
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	return (
		<>
			<Workspace
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={setSelectedId}
				onZoom={() => {}}
				onZoomFit={() => {}}
				selectedOverlayId={selectedId}
				state={history.present}
				zoom={0.5}
			/>

			<FilterGallery
				dispatch={dispatch}
				filter={history.present.filter}
				image={IMAGE}
				onAnnounce={() => {}}
			/>

			<AnnotatePanel
				bounds={rotatedSize(history.present)}
				dispatch={dispatch}
				onAnnounce={() => {}}
			/>

			<LayersPanel
				dispatch={dispatch}
				onAnnounce={() => {}}
				onSelect={setSelectedId}
				overlays={history.present.overlays}
				selectedId={selectedId}
			/>
		</>
	);
}

function TextStageHarness() {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		editorReducer(initialHistory(IMAGE.width, IMAGE.height), {
			overlay: {
				color: '#ffffff',
				fontFamily: 'sans-serif',
				fontSize: 48,
				id: 'text-1',
				kind: 'text',
				text: 'Hello',
				x: 100,
				y: 100,
			},
			type: 'add-overlay',
		})
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	return (
		<Workspace
			dispatch={dispatch}
			image={IMAGE}
			onAnnounce={() => {}}
			onCenterCrop={() => {}}
			onSelectOverlay={setSelectedId}
			onZoom={() => {}}
			onZoomFit={() => {}}
			selectedOverlayId={selectedId}
			state={history.present}
			zoom={0.5}
		/>
	);
}

describe('Annotations, filters, and layers', () => {
	it('has no axe violations with annotations present', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);
		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		expect(await axe(container)).toHaveNoViolations();
	});

	it('adds a sticker as a focusable, keyboard-movable SVG node', () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);

		const sticker = container.querySelector(
			'.overlay-hit'
		) as SVGRectElement;

		expect(sticker).toHaveAttribute('aria-label', 'Star sticker');

		const initialX = Number(sticker.getAttribute('x'));

		fireEvent.keyDown(sticker, {key: 'ArrowRight', shiftKey: true});
		fireEvent.keyUp(sticker, {key: 'ArrowRight', shiftKey: true});

		expect(Number(sticker.getAttribute('x'))).toBe(initialX + 10);
	});

	it('applies a filter preset from the radio group', () => {
		const {container} = render(<AnnotationHarness />);

		expect(container.querySelector('image')).not.toHaveAttribute(
			'filter'
		);

		fireEvent.click(screen.getByRole('radio', {name: 'Sepia'}));

		expect(screen.getByRole('radio', {name: 'Sepia'})).toBeChecked();
		expect(
			container.querySelector('.editor-workspace image')
		).toHaveAttribute('filter', 'url(#preview-filter)');
	});

	it('lists layers topmost first and reorders them from the listbox', () => {
		render(<AnnotationHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);
		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		const layerNames = () =>
			[...document.querySelectorAll('.editor-layer-name')].map(
				(node) => node.textContent
			);

		expect(layerNames()).toEqual(['Rectangle', 'Star sticker']);

		// Per-row action: move the topmost layer down.

		fireEvent.click(
			screen.getByRole('button', {name: 'Move Rectangle down'})
		);

		expect(layerNames()).toEqual(['Star sticker', 'Rectangle']);
	});

	it('edits the selected layer properties from the layers panel', () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		// The overlay's visual rect is the only rect without a class (the
		// crop border, move surface, and hit targets are all classed).

		const shape = () =>
			container.querySelector(
				'.editor-workspace rect:not([class])'
			) as SVGRectElement;

		expect(shape()).toHaveAttribute('fill', '#0b5fff');

		// Width commits on Enter.

		const widthInput = screen.getByLabelText('Width');

		fireEvent.change(widthInput, {target: {value: '500'}});
		fireEvent.keyDown(widthInput, {key: 'Enter'});

		expect(shape()).toHaveAttribute('width', '500');

		// Color commits on blur after picking.

		const colorInput = screen.getByLabelText('Color');

		fireEvent.change(colorInput, {target: {value: '#00ff00'}});
		fireEvent.blur(colorInput);

		expect(shape()).toHaveAttribute('fill', '#00ff00');

		// Opacity wraps the node in a translucent group, clamped to 0-100.

		const opacityInput = screen.getByLabelText('Opacity');

		fireEvent.change(opacityInput, {target: {value: '50'}});
		fireEvent.keyDown(opacityInput, {key: 'Enter'});

		expect(shape().closest('g[opacity]')).toHaveAttribute(
			'opacity',
			'0.5'
		);

		// Rotation spins the whole interactive group around the center.

		const rotationInput = screen.getByLabelText('Rotation');

		fireEvent.change(rotationInput, {target: {value: '45'}});
		fireEvent.keyDown(rotationInput, {key: 'Enter'});

		expect(shape().closest('g[transform]')?.getAttribute('transform')).toContain(
			'rotate(45'
		);
	});

	it('has no axe violations with the layer properties open', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		expect(await axe(container)).toHaveNoViolations();
	});

	it('syncs selection between the stage and the layers panel', () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);
		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		// Focusing the sticker on the stage selects its layer row.

		const hits = container.querySelectorAll('.overlay-hit');

		fireEvent.focus(hits[0]);

		expect(
			screen.getByRole('button', {name: 'Star sticker', pressed: true})
		).toBeInTheDocument();

		// Selecting the rectangle row shows the light ring on the stage.

		fireEvent.blur(hits[0]);

		fireEvent.click(
			screen.getByRole('button', {name: 'Rectangle', pressed: false})
		);

		expect(container.querySelectorAll('.selection-ring')).toHaveLength(1);

		// Clicking a non-interactive spot clears the visual selection.

		fireEvent.pointerDown(
			screen.getByRole('region', {name: 'Image workspace'})
		);

		expect(container.querySelectorAll('.selection-ring')).toHaveLength(0);
	});

	it('jumps from the stage node to its property editor on Enter', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		const hit = container.querySelector('.overlay-hit') as SVGRectElement;

		fireEvent.keyDown(hit, {key: 'Enter'});

		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(document.activeElement?.id).toBe('layer-prop-color');
	});

	it('duplicates a layer from its row and selects the copy', () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		fireEvent.click(
			screen.getByRole('button', {name: 'Duplicate Rectangle'})
		);

		expect(
			[...document.querySelectorAll('.editor-layer-name')].map(
				(node) => node.textContent
			)
		).toEqual(['Rectangle', 'Rectangle']);

		// The copy is selected: one pressed row, one light ring on stage.

		expect(
			screen.getAllByRole('button', {name: 'Rectangle', pressed: true})
		).toHaveLength(1);
		expect(container.querySelectorAll('.selection-ring')).toHaveLength(1);
	});

	it('edits a text annotation in place on double click', () => {
		const {container} = render(<TextStageHarness />);

		const hit = container.querySelector('.overlay-hit') as SVGRectElement;

		fireEvent.doubleClick(hit);

		const editor = container.querySelector(
			'.overlay-text-editor'
		) as HTMLInputElement;

		expect(editor).toBeInTheDocument();
		expect(editor.value).toBe('Hello');

		fireEvent.change(editor, {target: {value: 'Liferay'}});
		fireEvent.keyDown(editor, {key: 'Enter'});

		expect(container.querySelector('.overlay-text-editor')).toBeNull();
		expect(
			container.querySelector('.editor-workspace text')?.textContent
		).toBe('Liferay');
	});

	it('roves a single tab stop through the annotate controls', () => {
		render(<AnnotationHarness />);

		const addText = screen.getByRole('button', {name: 'Add text'});

		addText.focus();

		// Add text, Add rectangle, Add redaction, then the stickers.

		fireEvent.keyDown(addText, {key: 'ArrowRight'});

		for (let step = 0; step < 2; step++) {
			fireEvent.keyDown(document.activeElement as Element, {
				key: 'ArrowRight',
			});
		}

		expect(document.activeElement).toHaveAccessibleName(
			'Add star sticker'
		);

		// Exactly one tab stop across the whole panel.

		expect(
			document.querySelectorAll(
				'.editor-panel [data-index][tabindex="0"]'
			)
		).toHaveLength(1);

		fireEvent.keyDown(document.activeElement as Element, {key: 'Home'});

		expect(document.activeElement).toHaveAccessibleName('Add text');
	});

	it('jumps from a layer row to its element on the stage on Enter', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		const row = screen.getByRole('button', {
			name: 'Rectangle',
			pressed: true,
		});

		expect(row).toHaveAttribute(
			'aria-describedby',
			'layer-name-description'
		);

		fireEvent.keyDown(row, {key: 'Enter'});

		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(document.activeElement).toBe(
			container.querySelector('.overlay-hit')
		);
	});

	it('adds a redaction that pixelates through a clipped source', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add redaction'}));

		expect(
			document.querySelector('.editor-layer-name')?.textContent
		).toBe('Redacted area');

		const pixels = container.querySelector(
			'[clip-path^="url(#redact-clip-"] image'
		) as SVGImageElement;

		expect(pixels).toHaveAttribute('href', 'm.png');

		// The level select swaps the downsampled source.

		fireEvent.change(screen.getByLabelText('Pixel size'), {
			target: {value: 'coarse'},
		});

		expect(
			container.querySelector('[clip-path^="url(#redact-clip-"] image')
		).toHaveAttribute('href', 'c.png');

		// Same box handles as a rectangle: 4 corners + 4 edges + rotate.

		fireEvent.focus(container.querySelector('.overlay-hit') as Element);

		expect(container.querySelectorAll('.object-handle')).toHaveLength(9);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('deletes a layer from its row and hides the empty panel', () => {
		render(<AnnotationHarness />);

		expect(screen.queryByText('Layers')).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);

		expect(screen.getByText('Layers')).toBeInTheDocument();

		// Delete on the layer's name button removes the layer.

		fireEvent.keyDown(
			screen.getByRole('button', {name: 'Star sticker', pressed: true}),
			{key: 'Delete'}
		);

		expect(screen.queryByText('Layers')).not.toBeInTheDocument();
	});
});
