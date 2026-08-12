/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {initialEditState} from '../state/editorReducer';
import {coverScale, imageTransform} from './geometry';

describe('coverScale', () => {
	it('is neutral without an angle', () => {
		expect(coverScale(1600, 1000, 0)).toBe(1);
	});

	it('grows the image so a rotated frame stays covered', () => {
		// A square rotated 45 degrees needs to grow by sqrt(2).

		expect(coverScale(1000, 1000, 45)).toBeCloseTo(Math.SQRT2, 4);
		expect(coverScale(1000, 1000, -45)).toBeCloseTo(Math.SQRT2, 4);
	});

	it('grows monotonically with the angle', () => {
		const small = coverScale(1600, 1000, 5);
		const large = coverScale(1600, 1000, 20);

		expect(small).toBeGreaterThan(1);
		expect(large).toBeGreaterThan(small);
	});
});

describe('imageTransform', () => {
	it('is undefined when nothing is rotated', () => {
		expect(imageTransform(initialEditState(1600, 1000))).toBeUndefined();
	});

	it('combines the straighten angle with the quarter turns', () => {
		const transform = imageTransform({
			...initialEditState(1600, 1000),
			angle: 8,
			rotation: 90,
		});

		expect(transform).toContain('rotate(8');
		expect(transform).toContain('rotate(90)');
		expect(transform).toContain('scale(');
	});
});
