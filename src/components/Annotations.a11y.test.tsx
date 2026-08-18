/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, render, screen, within} from '@testing-library/react';
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

	// Held as the editor holds it: the panel offers it, the stage obeys.

	const [proportional, setProportional] = useState(false);

	return (
		<>
			<Workspace
				aspectLocked={false}
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={setSelectedId}
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomActual={() => {}}
				onZoomFit={() => {}}
				proportional={proportional}
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
				onProportionalChange={setProportional}
				onSelect={setSelectedId}
				overlays={history.present.overlays}
				proportional={proportional}
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

	const [proportional, setProportional] = useState(false);

	return (
		<>
			<Workspace
				aspectLocked={false}
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={setSelectedId}
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomActual={() => {}}
				onZoomFit={() => {}}
				proportional={proportional}
				selectedOverlayId={selectedId}
				showCrop
				showRecenter
				state={history.present}
				zoom={0.5}
			/>

			<LayersPanel
				dispatch={dispatch}
				onAnnounce={() => {}}
				onProportionalChange={setProportional}
				onSelect={setSelectedId}
				overlays={history.present.overlays}
				proportional={proportional}
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

	const [proportional] = useState(false);

	return (
		<>
			<Workspace
				aspectLocked={false}
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onCenterCrop={() => {}}
				onSelectOverlay={setSelectedId}
				onWorkspaceScroll={() => {}}
				onZoom={() => {}}
				onZoomActual={() => {}}
				onZoomFit={() => {}}
				proportional={proportional}
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

/**
 * Shapes and stickers live behind a menu of drawings, so adding one is two
 * steps: open the menu, then pick the cell. The cells are named rather
 * than labelled in text, and the query goes through the grid because the
 * same name also belongs to the stage node and the layer row it creates.
 */
function addFromMenu(menu: string, item: string) {
	fireEvent.click(screen.getByRole('button', {name: menu}));

	fireEvent.click(
		within(screen.getByRole('grid', {name: menu})).getByRole('button', {
			name: item,
		})
	);
}

const addShape = (shape: string) => addFromMenu('Add shape', shape);

const addSticker = (sticker: string) => addFromMenu('Add sticker', sticker);

describe('Annotations, filters, and layers', () => {
	it('has no axe violations with annotations present', async () => {
		const {container} = render(<AnnotationHarness />);

		addSticker('Star sticker');
		addShape('Rectangle');

		expect(await axe(container)).toHaveNoViolations();
	});

	it('adds an arrow, aimed by its ends rather than by a box', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Arrow');

		const hit = container.querySelector('.overlay-hit') as SVGRectElement;

		expect(hit).toHaveAttribute('aria-label', 'Arrow');

		// A shaft and a solid head, which is the default style.

		expect(
			container.querySelectorAll('.editor-workspace polygon')
		).toHaveLength(1);

		// Its two ends are the properties, and rotation is not one of
		// them: where an arrow points is already said by its ends.

		expect(screen.getByLabelText('Tip X position')).toBeInTheDocument();
		expect(screen.getByLabelText('Tip Y position')).toBeInTheDocument();
		expect(screen.queryByLabelText('Rotation')).not.toBeInTheDocument();

		// Aiming it without a pointer: the tip moves, the tail stays.

		const tipY = screen.getByLabelText('Tip Y position');
		const tailY = Number(screen.getByLabelText('Y position').getAttribute('value'));

		fireEvent.change(tipY, {target: {value: '120'}});
		fireEvent.keyDown(tipY, {key: 'Enter'});

		expect(screen.getByLabelText('Tip Y position')).toHaveValue(120);
		expect(screen.getByLabelText('Y position')).toHaveValue(tailY);

		// The open head is the same two barbs left as strokes, and its
		// shaft runs the whole way: only a solid head needs the line to
		// stop short of the point.

		fireEvent.change(screen.getByLabelText('Arrow head'), {
			target: {value: 'open'},
		});

		expect(
			container.querySelectorAll('.editor-workspace polygon')
		).toHaveLength(0);
		expect(
			container.querySelectorAll(
				'.editor-workspace path[stroke-linejoin="round"]'
			)
		).toHaveLength(1);

		const shaft = container.querySelector(
			'.editor-workspace line[stroke-linecap="round"]'
		) as SVGLineElement;

		expect(Number(shaft.getAttribute('y2'))).toBe(120);
		expect(Number(shaft.getAttribute('y1'))).toBe(tailY);
	});

	it('offers the square and the circle from the same menu', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Square');

		const square = container.querySelector(
			'.editor-workspace rect[fill]:not([class])'
		) as SVGRectElement;

		expect(square.getAttribute('width')).toBe(square.getAttribute('height'));

		addShape('Circle');

		expect(
			container.querySelectorAll('.editor-workspace ellipse')
		).toHaveLength(1);
	});

	it('adds an emoji as a layer of its own, sized but never coloured', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add emoji'}));

		// Found rather than got: the picker is a lazy chunk, loaded the
		// first time the button is pressed.

		fireEvent.click(
			within(await screen.findByRole('grid', {name: 'Add emoji'})).getByRole(
				'button',
				{name: 'star'}
			)
		);

		// Its own kind: named by Unicode, drawn as the character.

		const hit = container.querySelector('.overlay-hit') as SVGRectElement;

		expect(hit).toHaveAttribute('aria-label', 'star');

		// The row shows the glyph itself in front of the name.

		expect(
			container.querySelector('.editor-layer-glyph')?.textContent
		).toBe('⭐');

		// Size yes; colour and font are the platform's business.

		expect(screen.getByLabelText('Size')).toBeInTheDocument();
		expect(screen.queryByLabelText('Color')).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText('Font family')
		).not.toBeInTheDocument();
	});

	it('finds an emoji whatever the capitalisation of its name', async () => {
		render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add emoji'}));

		// Unicode writes "flag: Spain"; the search must not care.

		fireEvent.change(await screen.findByLabelText('Search emoji'), {
			target: {value: 'spain'},
		});

		expect(
			within(screen.getByRole('grid', {name: 'Add emoji'})).getByRole(
				'button',
				{name: 'flag: Spain'}
			)
		).toBeInTheDocument();
	});

	it('adds a sticker as a focusable, keyboard-movable SVG node', () => {
		const {container} = render(<AnnotationHarness />);

		addSticker('Star sticker');

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
			...container.querySelectorAll('.editor-preset-thumb image'),
		];

		expect(thumbs).toHaveLength(20);
		expect(
			thumbs.every((thumb) => thumb.getAttribute('href') === 'thumb.jpg')
		).toBe(true);
	});

	it('lists layers topmost first and reorders them from the listbox', () => {
		render(<AnnotationHarness />);

		addSticker('Star sticker');
		addShape('Rectangle');

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

		addShape('Rectangle');

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

		addShape('Rectangle');

		expect(await axe(container)).toHaveNoViolations();
	});

	it('leaves a shape free to stretch, and locks on request', () => {
		render(<AnnotationHarness />);

		addShape('Rectangle');

		const padlock = screen.getByRole('button', {
			name: 'Lock aspect ratio',
		});

		// A rectangle is a shape rather than a picture, so it arrives free.

		expect(padlock).toHaveAttribute('aria-pressed', 'false');

		const width = screen.getByLabelText('Width') as HTMLInputElement;
		const height = screen.getByLabelText('Height') as HTMLInputElement;

		const stretched = Number(height.value);

		fireEvent.change(width, {target: {value: '200'}});
		fireEvent.keyDown(width, {key: 'Enter'});

		expect(Number(height.value)).toBe(stretched);

		// Locked, the side that was not typed follows.

		fireEvent.click(padlock);

		expect(padlock).toHaveAttribute('aria-pressed', 'true');

		const ratio = 200 / stretched;

		fireEvent.change(width, {target: {value: '100'}});
		fireEvent.keyDown(width, {key: 'Enter'});

		expect(Number(height.value)).toBe(Math.round(100 / ratio));
	});

	it('syncs selection between the stage and the layers panel', () => {
		const {container} = render(<AnnotationHarness />);

		addSticker('Star sticker');
		addShape('Rectangle');

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

		addShape('Rectangle');

		const hit = container.querySelector('.overlay-hit') as SVGRectElement;

		fireEvent.keyDown(hit, {key: 'Enter'});

		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(document.activeElement?.id).toBe('layer-prop-color');
	});

	it('duplicates a layer from its row and selects the copy', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Rectangle');

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

		// Add text, Add shape, Add redaction, Add image, Add sticker.

		for (let step = 0; step < 4; step++) {
			fireEvent.keyDown(document.activeElement as Element, {
				key: 'ArrowRight',
			});
		}

		expect(document.activeElement).toHaveAccessibleName('Add sticker');

		// One tab stop for the whole panel, wherever the roving index
		// happens to be sitting.

		expect(
			document.querySelectorAll(
				'.editor-annotate-actions [data-index][tabindex="0"]'
			)
		).toHaveLength(1);

		fireEvent.keyDown(document.activeElement as Element, {key: 'Home'});

		expect(document.activeElement).toHaveAccessibleName('Add text');

		// On a menu button the vertical arrows belong to the menu, so
		// they must not walk the panel.

		fireEvent.keyDown(document.activeElement as Element, {
			key: 'ArrowRight',
		});

		expect(document.activeElement).toHaveAccessibleName('Add shape');

		fireEvent.keyDown(document.activeElement as Element, {
			key: 'ArrowDown',
		});

		expect(document.activeElement).toHaveAccessibleName('Add shape');
	});

	it('jumps from a layer row to its element on the stage on Enter', async () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Rectangle');

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

		// New redactions start pixelated, at the light level.

		expect(pixels).toHaveAttribute('href', 'f.png');

		// The strength select swaps the downsampled source.

		fireEvent.change(screen.getByLabelText('Strength'), {
			target: {value: 'tiny'},
		});

		expect(
			container.querySelector('[clip-path^="url(#redact-clip-"] image')
		).toHaveAttribute('href', 't.png');

		// Blurring draws from the picture itself rather than from a
		// downsampled copy, through a filter of its own.

		fireEvent.change(screen.getByLabelText('Type'), {
			target: {value: 'blur'},
		});

		const blurred = container.querySelector(
			'[clip-path^="url(#redact-clip-"] image'
		) as SVGImageElement;

		expect(blurred).toHaveAttribute('href', 'test.jpg');

		expect(
			container.querySelector('filter[id^="redact-blur-"] feGaussianBlur')
		).toBeInTheDocument();

		// And back, without losing how much was being hidden.

		fireEvent.change(screen.getByLabelText('Type'), {
			target: {value: 'pixel'},
		});

		expect(
			container.querySelector('[clip-path^="url(#redact-clip-"] image')
		).toHaveAttribute('href', 't.png');

		// Same box handles as a rectangle: 4 corners + 4 edges + rotate.

		fireEvent.focus(container.querySelector('.overlay-hit') as Element);

		expect(container.querySelectorAll('.object-handle')).toHaveLength(9);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('adds a circle that behaves like the rectangle', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Circle');

		expect(container.querySelector('ellipse')).toBeInTheDocument();

		// It is a box like any other: the numeric properties drive it, and
		// the ellipse fills that box.

		const width = screen.getByLabelText('Width');

		fireEvent.change(width, {target: {value: '400'}});
		fireEvent.keyDown(width, {key: 'Enter'});

		expect(container.querySelector('ellipse')).toHaveAttribute(
			'rx',
			'200'
		);

		// Named once on the stage and once in the layers list, like every
		// other annotation. Counted inside the editor, since the picker
		// that made it is portaled out of it and has a cell of that name
		// too.

		expect(
			within(container).getAllByRole('button', {name: 'Circle'})
		).toHaveLength(2);
	});

	it('keeps a 24 pixel target on an annotation smaller than that', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Rectangle');

		for (const [label, value] of [
			['Width', '8'],
			['Height', '8'],
		]) {
			const field = screen.getByLabelText(label);

			fireEvent.change(field, {target: {value}});
			fireEvent.keyDown(field, {key: 'Enter'});
		}

		const shape = container.querySelector('rect[fill="#0b5fff"]');
		const hit = container.querySelector('.overlay-hit');

		// What is painted shrinks to what was asked for; what can be hit
		// does not go below the minimum (WCAG 2.2, 2.5.8). The harness
		// renders at 50%, so those 24 screen pixels are 48 image units:
		// the target is a screen measurement, not an image one.

		expect(shape).toHaveAttribute('width', '8');
		expect(hit).toHaveAttribute('width', '48');
		expect(hit).toHaveAttribute('height', '48');

		// And it stays centred on the annotation.

		expect(Number(hit!.getAttribute('x'))).toBe(
			Number(shape!.getAttribute('x')) - 20
		);
	});

	it('draws no border until one is asked for', () => {
		const {container} = render(<AnnotationHarness />);

		addShape('Rectangle');

		const shape = () => container.querySelector('rect[fill="#0b5fff"]');

		expect(shape()).not.toHaveAttribute('stroke');

		const width = screen.getByLabelText('Border width');

		fireEvent.change(width, {target: {value: '4'}});
		fireEvent.keyDown(width, {key: 'Enter'});

		expect(shape()).toHaveAttribute('stroke-width', '4');
		expect(shape()).toHaveAttribute('stroke');

		// Back to zero and the outline goes away again.

		fireEvent.change(screen.getByLabelText('Border width'), {
			target: {value: '0'},
		});
		fireEvent.keyDown(screen.getByLabelText('Border width'), {
			key: 'Enter',
		});

		expect(shape()).not.toHaveAttribute('stroke');
	});

	it('centers a new annotation on the crop, not on the image', () => {
		const {container} = render(<CroppedHarness />);

		addSticker('Star sticker');

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

		addSticker('Star sticker');

		expect(screen.getByText('Layers')).toBeInTheDocument();

		// Delete on the layer's name button removes the layer.

		fireEvent.keyDown(
			screen.getByRole('button', {name: 'Star sticker', pressed: true}),
			{key: 'Delete'}
		);

		expect(screen.queryByText('Layers')).not.toBeInTheDocument();
	});
});
