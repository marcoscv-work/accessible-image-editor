/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {
	DEFAULT_SECTIONS,
	resolveSections,
	sectionsFromSearch,
} from './editorSections';

describe('editor sections', () => {
	it('exposes every block by default', () => {
		expect(resolveSections()).toEqual(DEFAULT_SECTIONS);
	});

	it('keeps omitted keys at their default', () => {
		expect(resolveSections({annotate: false})).toEqual({
			...DEFAULT_SECTIONS,
			annotate: false,
		});
	});

	it('reads an allowlist from the query string', () => {
		expect(sectionsFromSearch('?sections=crop,%20Filters')).toEqual({
			adjustments: false,
			annotate: false,
			crop: true,
			filters: true,
		});
	});

	it('ignores an absent parameter', () => {
		expect(sectionsFromSearch('?other=1')).toBeUndefined();
	});
});
