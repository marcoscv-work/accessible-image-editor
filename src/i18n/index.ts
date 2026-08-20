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

/**
 * What a host hands over to localize the editor: the same shape as a
 * Clay component's `messages` prop, a partial dictionary whose missing
 * keys keep the bundled English. In the portal the host builds it with
 * one literal `Liferay.Language.get('key')` call per key (the language
 * filter substitutes literals, never dynamic lookups), which is what
 * `scripts/generate-liferay-messages.mjs` writes out.
 */
export type EditorMessages = Partial<Record<TranslationKey, string>>;

let dictionary: Record<string, string> = en;

/**
 * Installs the host's messages. One locale per page: the seam is a
 * module, matching how the portal itself localizes. `null` restores the
 * bundled English.
 */
export function setMessages(value: EditorMessages | null): void {
	if (value === null) {
		dictionary = en;

		return;
	}

	const merged: Record<string, string> = {...en};

	for (const [key, translation] of Object.entries(value)) {
		if (typeof translation === 'string') {
			merged[key] = translation;
		}
	}

	dictionary = merged;
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
	let value = dictionary[key] ?? key;

	args.forEach((arg, index) => {
		value = value.replaceAll(`{${index}}`, String(arg));
	});

	return value;
}
