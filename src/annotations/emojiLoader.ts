/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import type {EmojiEntry} from './emojiData';

/**
 * The catalogue plus everything derived from it once: the lowercased
 * search keys and the by-character index the common grid is built from.
 */
export interface EmojiCatalog {
	byCharacter: Map<string, EmojiEntry>;
	entries: EmojiEntry[];
	searchKeys: string[];
}

let cache: EmojiCatalog | null = null;

/**
 * The async boundary around the emoji data. The ~1,900-entry catalogue
 * is the heavy part of the picker, not the component, so this is where
 * the chunk splits: a dynamic import today, swappable for a fetch of a
 * static resource in a host whose bundler dislikes in-library chunks,
 * without the picker knowing the difference.
 */
export async function loadEmojiCatalog(): Promise<EmojiCatalog> {
	if (!cache) {
		const {EMOJI} = await import('./emojiData');

		cache = {
			byCharacter: new Map(EMOJI.map((entry) => [entry.c, entry])),
			entries: EMOJI,
			searchKeys: EMOJI.map((entry) => entry.n.toLowerCase()),
		};
	}

	return cache;
}
