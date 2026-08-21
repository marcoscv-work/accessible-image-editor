/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import '@testing-library/jest-dom';

import {TranslationKey, setMessages, t} from '../../src/i18n/index';

afterEach(() => setMessages(null));

describe('the i18n seam', () => {
	it('formats Liferay-style placeholders', () => {
		expect(t('image-saved-as-x', 'photo.jpg')).toBe(
			'Image saved as photo.jpg'
		);
	});

	it('falls back to the key rather than to silence', () => {
		expect(t('not-a-real-key' as TranslationKey)).toBe('not-a-real-key');
	});

	it('lets a host override part of the dictionary, Clay-style', () => {
		setMessages({save: 'Guardar'});

		expect(t('save')).toBe('Guardar');

		// Missing keys keep the bundled English.

		expect(t('cancel')).toBe('Cancel');

		setMessages(null);

		expect(t('save')).toBe('Save');
	});
});
