/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {describe, expect, it} from 'vitest';

import {sessionKeyOf} from './AccessibleImageEditor';
import {LoadedImage} from './imaging/loadImage';

const image = (previewUrl: string): LoadedImage => ({
	blob: new Blob(),
	fileName: 'a.jpg',
	height: 800,
	pixelUrls: {coarse: 'c', fine: 'f', medium: 'm', tiny: 't'},
	previewUrl,
	thumbUrl: 'thumb',
	type: 'image/jpeg',
	width: 1200,
});

describe('the editing session is keyed to the image (R2-002)', () => {
	it('derives a different session key for a different image', () => {

		// The key is what remounts the internal session when the host
		// swaps `image` in place: React tears the old reducer, zoom,
		// selection and save controller down with the old key. Distinct
		// preview URLs are guaranteed by loadImage, which mints an
		// object URL per call.

		expect(sessionKeyOf(image('blob:a'))).not.toBe(
			sessionKeyOf(image('blob:b'))
		);
		expect(sessionKeyOf(image('blob:a'))).toBe(
			sessionKeyOf(image('blob:a'))
		);
	});
});
