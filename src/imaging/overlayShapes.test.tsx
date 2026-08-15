/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {describe, expect, it} from 'vitest';

import {ImageOverlay, isBoxOverlay} from '../state/types';
import {
	mirrorOverlay,
	overlayBounds,
	overlayHitBox,
	overlayLabel,
} from './overlayShapes';

const PICTURE: ImageOverlay = {
	description: 'Team badge',
	height: 40,
	id: 'image-1',
	kind: 'image',
	src: 'data:image/png;base64,AAAA',
	width: 80,
	x: 100,
	y: 50,
};

describe('an image annotation', () => {
	it('is one more box, so it stretches and mirrors like the rest', () => {
		expect(isBoxOverlay(PICTURE)).toBe(true);

		expect(overlayBounds(PICTURE)).toEqual({
			height: 40,
			width: 80,
			x: 100,
			y: 50,
		});

		// Mirrored inside a 1000 wide frame: 1000 - 100 - 80.

		expect(mirrorOverlay(PICTURE, 1000)).toMatchObject({x: 820});
	});

	it('is named by its description, which is what is read out', () => {
		expect(overlayLabel(PICTURE)).toBe('Team badge');
	});

	it('keeps a full size target when the picture is a small badge', () => {
		const stamp = {...PICTURE, height: 6, width: 6};

		// Painted at 6, hit at 24, centred on the same point (WCAG 2.5.8).

		expect(overlayHitBox(stamp, 24)).toEqual({
			height: 24,
			width: 24,
			x: 91,
			y: 41,
		});
	});
});
