import {applyResizeModifiers} from './CropMarquee';

const ORIGIN = {height: 400, width: 800, x: 100, y: 100};

describe('applyResizeModifiers', () => {
	it('passes the base rectangle through without modifiers', () => {
		const base = {height: 400, width: 900, x: 100, y: 100};

		expect(
			applyResizeModifiers(base, ORIGIN, {right: true}, {
				center: false,
				proportional: false,
			})
		).toEqual(base);
	});

	it('keeps the origin proportions on a shift edge drag', () => {
		// Right edge dragged +200: width 1000, so height follows the 2:1
		// ratio (500), vertically centered on the origin.

		const base = {height: 400, width: 1000, x: 100, y: 100};

		const result = applyResizeModifiers(base, ORIGIN, {right: true}, {
			center: false,
			proportional: true,
		});

		expect(result).toEqual({height: 500, width: 1000, x: 100, y: 50});
	});

	it('anchors the opposite corner on a shift corner drag', () => {
		// Bottom-right corner: +200 wide dominates +50 tall.

		const base = {height: 450, width: 1000, x: 100, y: 100};

		const result = applyResizeModifiers(
			base,
			ORIGIN,
			{bottom: true, right: true},
			{center: false, proportional: true}
		);

		expect(result).toEqual({height: 500, width: 1000, x: 100, y: 100});
	});

	it('resizes around the center with alt', () => {
		// Right edge +50 grows both sides: width +100, center preserved.

		const base = {height: 400, width: 850, x: 100, y: 100};

		const result = applyResizeModifiers(base, ORIGIN, {right: true}, {
			center: true,
			proportional: false,
		});

		expect(result).toEqual({height: 400, width: 900, x: 50, y: 100});
	});

	it('combines alt and shift into a centered proportional resize', () => {
		const base = {height: 400, width: 900, x: 100, y: 100};

		const result = applyResizeModifiers(base, ORIGIN, {right: true}, {
			center: true,
			proportional: true,
		});

		expect(result).toEqual({height: 500, width: 1000, x: 0, y: 50});
	});

	it('ignores modifiers for a plain move gesture', () => {
		const base = {height: 400, width: 800, x: 300, y: 200};

		expect(
			applyResizeModifiers(base, ORIGIN, {}, {
				center: true,
				proportional: true,
			})
		).toEqual(base);
	});
});
