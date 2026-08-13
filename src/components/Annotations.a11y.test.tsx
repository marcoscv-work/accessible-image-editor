/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useReducer, useState} from 'react';

import {ANNOTATE_TOOLS} from '../editorConfig';
import {FILTER_PRESETS} from '../imaging/FilterDefs';
import {LoadedImage} from '../imaging/loadImage';
import {STICKER_KINDS} from '../imaging/overlayShapes';
import {
	editorReducer,
	initialHistory,
} from '../state/editorReducer';
import {AnnotatePanel} from './AnnotatePanel';
import {FilterGallery} from './FilterGallery';
import {LayersPanel} from './LayersPanel';
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
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				selectedOverlayId={selectedId}
				showCrop
				showRecenter
				state={history.present}
				zoom={0.5}
			/>

			<FilterGallery
				dispatch={dispatch}
				filter={history.present.filter}
				image={IMAGE}
				onAnnounce={() => {}}
				presets={FILTER_PRESETS}
			/>

			<AnnotatePanel
				area={history.present.crop}
				dispatch={dispatch}
				onAnnounce={() => {}}
				stickers={STICKER_KINDS}
				tools={ANNOTATE_TOOLS}
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
		<>
			<Workspace
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={setSelectedId}
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				selectedOverlayId={selectedId}
				showCrop
				showRecenter
				state={history.present}
				zoom={0.5}
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

/**
 * A stage cropped to the bottom-right quadrant, to check where new
 * annotations land.
 */
function CroppedHarness() {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		editorReducer(initialHistory(IMAGE.width, IMAGE.height), {
			crop: {height: 400, width: 600, x: 600, y: 400},
			type: 'set-crop',
		})
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
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomFit={() => {}}
				selectedOverlayId={selectedId}
				showCrop
				showRecenter
				state={history.present}
				zoom={0.5}
			/>

			<AnnotatePanel
				area={history.present.crop}
				dispatch={dispatch}
				onAnnounce={() => {}}
				stickers={STICKER_KINDS}
				tools={ANNOTATE_TOOLS}
			/>
		</>
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

	it('renders the filters as cards backed by hidden radios', () => {
		const {container} = render(<AnnotationHarness />);

		const radios = screen.getAllByRole('radio');

		expect(radios).toHaveLength(20);

		// The inputs are visually hidden but still real radios, so the
		// group keeps its semantics and its keyboard behaviour.

		for (const radio of radios) {
			expect(radio).toHaveClass('sr-only');
			expect(radio).not.toBeDisabled();
		}

		// Every card paints from the tiny thumbnail source, never from the
		// full preview bitmap.

		const thumbs = [
			...container.querySelectorAll('.editor-filter-thumb image'),
		];

		expect(thumbs).toHaveLength(20);
		expect(
			thumbs.every((thumb) => thumb.getAttribute('href') === 'thumb.jpg')
		).toBe(true);
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

		// The overlay's visual rect is the only filled rect without a
		// class (crop chrome is classed, the clip rect has no fill).

		const shape = () =>
			container.querySelector(
				'.editor-workspace rect[fill]:not([class])'
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

		// Position, which is what makes dragging optional for a pointer user
		// who cannot drag (WCAG 2.2, 2.5.7 Dragging Movements).

		const xInput = screen.getByLabelText('X position');
		const yInput = screen.getByLabelText('Y position');

		fireEvent.change(xInput, {target: {value: '120'}});
		fireEvent.keyDown(xInput, {key: 'Enter'});
		fireEvent.change(yInput, {target: {value: '340'}});
		fireEvent.keyDown(yInput, {key: 'Enter'});

		expect(shape()).toHaveAttribute('x', '120');
		expect(shape()).toHaveAttribute('y', '340');

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

	it('changes the font family of an existing text layer', () => {
		const {container} = render(<TextStageHarness />);

		const label = () => container.querySelector('.editor-workspace text');

		expect(label()).toHaveAttribute('font-family', 'sans-serif');

		fireEvent.change(screen.getByLabelText('Font family'), {
			target: {value: 'monospace'},
		});

		expect(label()).toHaveAttribute('font-family', 'monospace');
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

		// One tab stop per container, so the sticker picker is reachable
		// with Tab even while the roving index sits on a tool: in the
		// stacked layout the picker is a horizontal scroll container.

		expect(
			document.querySelectorAll(
				'.editor-annotate-actions [data-index][tabindex="0"]'
			)
		).toHaveLength(1);

		expect(
			document.querySelectorAll(
				'.editor-sticker-picker [data-index][tabindex="0"]'
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

		// New redactions start at the small-block level.

		expect(pixels).toHaveAttribute('href', 'f.png');

		// The level select swaps the downsampled source.

		fireEvent.change(screen.getByLabelText('Pixel size'), {
			target: {value: 'tiny'},
		});

		expect(
			container.querySelector('[clip-path^="url(#redact-clip-"] image')
		).toHaveAttribute('href', 't.png');

		// Same box handles as a rectangle: 4 corners + 4 edges + rotate.

		fireEvent.focus(container.querySelector('.overlay-hit') as Element);

		expect(container.querySelectorAll('.object-handle')).toHaveLength(9);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('centers a new annotation on the crop, not on the image', () => {
		const {container} = render(<CroppedHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);

		const sticker = container.querySelector(
			'.overlay-hit'
		) as SVGRectElement;

		const centerX =
			Number(sticker.getAttribute('x')) +
			Number(sticker.getAttribute('width')) / 2;
		const centerY =
			Number(sticker.getAttribute('y')) +
			Number(sticker.getAttribute('height')) / 2;

		// Center of the crop (900, 600), not of the image (600, 400).

		expect(Math.round(centerX)).toBe(900);
		expect(Math.round(centerY)).toBe(600);
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
