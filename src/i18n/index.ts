/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import en from './en';

/**
 * Every key the editor can ask for. Typed, so a component cannot request
 * a string the catalogue does not carry: the compiler catches the typo,
 * not a screen reader user hearing a raw key.
 */
export type TranslationKey = keyof typeof en;

export type Translator = (
	key: TranslationKey,
	...args: Array<string | number>
) => string;

let dictionary: Record<string, string> = en;

let custom: Translator | null = null;

/**
 * How a host localizes the editor. Either hand over a partial dictionary
 * (missing keys keep the bundled English) or a full translator function,
 * which is the shape of Liferay's `Language.get`. One locale per page:
 * the seam is a module, matching how the portal itself localizes.
 */
export function setTranslations(
	value: Partial<Record<TranslationKey, string>> | Translator | null
): void {
	if (value === null) {
		custom = null;
		dictionary = en;
	}
	else if (typeof value === 'function') {
		custom = value;
	}
	else {
		custom = null;

		const merged: Record<string, string> = {...en};

		for (const [key, translation] of Object.entries(value)) {
			if (typeof translation === 'string') {
				merged[key] = translation;
			}
		}

		dictionary = merged;
	}
}

/**
 * Translation entry point. Every user-facing string in the app goes through
 * this function so the dictionary can be swapped for Liferay's
 * Language.properties without touching components. Placeholders use the
 * Liferay convention: {0}, {1}, ...
 */
export function t(
	key: TranslationKey,
	...args: Array<string | number>
): string {
	if (custom) {
		return custom(key, ...args);
	}

	let value = dictionary[key] ?? key;

	args.forEach((arg, index) => {
		value = value.replaceAll(`{${index}}`, String(arg));
	});

	return value;
}
