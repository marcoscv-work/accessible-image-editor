/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import '@testing-library/jest-dom';

import {
	pointsBounds,
	pointsToPath,
	simplifyPoints,
	sketchyEllipsePath,
	sketchyRectPath,
} from '../../src/imaging/strokeGeometry';

describe('simplifyPoints', () => {
	it('collapses collinear runs to their endpoints', () => {
		const line = [0, 0, 10, 0, 20, 0, 30, 0, 40, 0];

		expect(simplifyPoints(line, 1)).toEqual([0, 0, 40, 0]);
	});

	it('keeps a corner the tolerance cannot excuse', () => {
		const corner = [0, 0, 50, 0, 100, 80];

		expect(simplifyPoints(corner, 2)).toEqual(corner);
	});

	it('leaves a two-point stroke alone', () => {
		expect(simplifyPoints([3, 4, 5, 6], 10)).toEqual([3, 4, 5, 6]);
	});
});

describe('pointsToPath', () => {
	it('draws straight segments when asked', () => {
		expect(pointsToPath([0, 0, 10, 5, 20, 0], false)).toBe(
			'M0 0 L10 5 L20 0'
		);
	});

	it('passes the curve through every placed point', () => {
		const path = pointsToPath([0, 0, 10, 5, 20, 0], true);

		// Catmull-Rom interpolates: the anchors appear verbatim as the
		// bezier endpoints, so the pen lands exactly where it was told.

		expect(path.startsWith('M0 0')).toBe(true);
		expect(path).toContain('10 5');
		expect(path.endsWith('20 0')).toBe(true);
	});

	it('turns a single point into a dot the linecap can paint', () => {
		expect(pointsToPath([7, 7], true)).toBe('M7 7 l0.01 0');
	});
});

describe('pointsBounds', () => {
	it('boxes the points', () => {
		expect(pointsBounds([10, 20, -5, 8, 30, 4])).toEqual({
			height: 16,
			width: 35,
			x: -5,
			y: 4,
		});
	});
});

describe('the hand-drawn style', () => {
	it('wobbles the same way for the same seed', () => {
		expect(sketchyRectPath(10, 10, 200, 100, 42)).toBe(
			sketchyRectPath(10, 10, 200, 100, 42)
		);

		expect(sketchyEllipsePath(50, 50, 40, 30, 7)).toBe(
			sketchyEllipsePath(50, 50, 40, 30, 7)
		);
	});

	it('wobbles differently for different seeds', () => {
		expect(sketchyRectPath(10, 10, 200, 100, 1)).not.toBe(
			sketchyRectPath(10, 10, 200, 100, 2)
		);
	});

	it('closes both shapes', () => {
		expect(sketchyRectPath(0, 0, 100, 50, 3).endsWith('Z')).toBe(true);
		expect(sketchyEllipsePath(0, 0, 40, 40, 3).endsWith('Z')).toBe(true);
	});
});
