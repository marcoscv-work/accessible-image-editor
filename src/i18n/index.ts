/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import en from './en';

const dictionary: Record<string, string> = en;

/**
 * Translation entry point. Every user-facing string in the app goes through
 * this function so the dictionary can later be swapped for Liferay's
 * Language.properties without touching components. Placeholders use the
 * Liferay convention: {0}, {1}, ...
 */
export function t(key: string, ...args: Array<string | number>): string {
	let value = dictionary[key] ?? key;

	args.forEach((arg, index) => {
		value = value.replaceAll(`{${index}}`, String(arg));
	});

	return value;
}
