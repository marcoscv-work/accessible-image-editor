/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {afterEach, describe, expect, it} from 'vitest';

import {TranslationKey, setTranslations, t} from './index';

afterEach(() => setTranslations(null));

describe('the i18n seam', () => {
	it('formats Liferay-style placeholders', () => {
		expect(t('image-saved', 'photo.jpg')).toBe('Image saved as photo.jpg');
	});

	it('falls back to the key rather than to silence', () => {
		expect(t('not-a-real-key' as TranslationKey)).toBe('not-a-real-key');
	});

	it('lets a host override part of the dictionary', () => {
		setTranslations({save: 'Guardar'});

		expect(t('save')).toBe('Guardar');

		// Missing keys keep the bundled English.

		expect(t('cancel')).toBe('Cancel');

		setTranslations(null);

		expect(t('save')).toBe('Save');
	});

	it('lets a host take over translation entirely', () => {
		setTranslations((key, ...args) => `[${key}:${args.join(',')}]`);

		expect(t('image-saved', 'x.jpg')).toBe('[image-saved:x.jpg]');
	});
});
