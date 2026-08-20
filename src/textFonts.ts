/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {TranslationKey} from './i18n';

/**
 * Font families offered for text annotations. Shared by the add dialog and
 * the layer properties so the two cannot drift apart.
 */
export const FONT_FAMILIES: Array<{
	labelKey: TranslationKey;
	value: string;
}> = [
	{labelKey: 'sans-serif', value: 'sans-serif'},
	{labelKey: 'serif', value: 'serif'},
	{labelKey: 'monospace', value: 'monospace'},
];
