/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Which editing blocks the editor exposes. Consumers pass a partial
 * object and every omitted key keeps its default, so the component can be
 * embedded with a reduced feature set (a crop-only picker, an
 * adjustments-only tuner, and so on) without forking the UI.
 */
export interface EditorSections {
	adjustments: boolean;

	/**
	 * Text, shapes, stickers and redactions, plus the layers panel that
	 * manages them.
	 */
	annotate: boolean;

	/**
	 * The crop panel, the on-stage marquee, and the ratio control.
	 */
	crop: boolean;

	filters: boolean;
}

export const DEFAULT_SECTIONS: EditorSections = {
	adjustments: true,
	annotate: true,
	crop: true,
	filters: true,
};

export function resolveSections(
	sections?: Partial<EditorSections>
): EditorSections {
	return {...DEFAULT_SECTIONS, ...sections};
}

/**
 * Reads a section allowlist from the URL (`?sections=crop,filters`) so a
 * hosted build can be tried in different configurations without a code
 * change. Returns undefined when the parameter is absent.
 */
export function sectionsFromSearch(
	search: string
): Partial<EditorSections> | undefined {
	const value = new URLSearchParams(search).get('sections');

	if (!value) {
		return undefined;
	}

	const allowed = new Set(
		value
			.split(',')
			.map((name) => name.trim().toLowerCase())
			.filter(Boolean)
	);

	return {
		adjustments: allowed.has('adjustments'),
		annotate: allowed.has('annotate'),
		crop: allowed.has('crop'),
		filters: allowed.has('filters'),
	};
}
