import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useReducer} from 'react';

import {LoadedImage} from '../imaging/loadImage';
import {editorReducer, initialHistory} from '../state/editorReducer';
import {rotatedSize} from '../state/types';
import {AnnotatePanel} from './AnnotatePanel';
import {FilterGallery} from './FilterGallery';
import {LayersPanel} from './LayersPanel';
import {Workspace} from './Workspace';

const IMAGE: LoadedImage = {
	blob: new Blob(),
	fileName: 'test.jpg',
	height: 800,
	previewUrl: 'test.jpg',
	type: 'image/jpeg',
	width: 1200,
};

function AnnotationHarness() {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		initialHistory(IMAGE.width, IMAGE.height)
	);

	return (
		<>
			<Workspace
				dispatch={dispatch}
				image={IMAGE}
				onAnnounce={() => {}}
				onZoom={() => {}}
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
				overlays={history.present.overlays}
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
		render(<AnnotationHarness />);

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);

		const sticker = screen.getByRole('button', {name: 'Star sticker'});

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

		const options = screen.getAllByRole('option');

		expect(options.map((option) => option.textContent)).toEqual([
			'Rectangle',
			'Star sticker',
		]);

		// The topmost layer is selected by default; move it down.

		fireEvent.click(screen.getByRole('button', {name: 'Move down'}));

		expect(
			screen.getAllByRole('option').map((option) => option.textContent)
		).toEqual(['Star sticker', 'Rectangle']);
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
	});

	it('has no axe violations with the layer properties open', async () => {
		const {container} = render(<AnnotationHarness />);

		fireEvent.click(screen.getByRole('button', {name: 'Add rectangle'}));

		expect(await axe(container)).toHaveNoViolations();
	});

	it('deletes the selected layer and hides the empty layers panel', () => {
		render(<AnnotationHarness />);

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {name: 'Add star sticker'})
		);

		const listbox = screen.getByRole('listbox');

		fireEvent.keyDown(listbox, {key: 'Delete'});

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		expect(screen.queryByText('Layers')).not.toBeInTheDocument();
	});
});
