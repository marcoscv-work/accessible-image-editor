/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {createContext, useCallback, useContext} from 'react';

/**
 * Every DOM id the editor mints goes through this prefix, so two editors
 * on one page cannot cross-wire their labels, descriptions and SVG
 * references. The default keeps lone components (tests, stories) working
 * without a provider.
 */
const EditorInstanceContext = createContext('aie-');

let instanceCounter = 0;

export function nextEditorInstancePrefix(): string {
	return `aie${++instanceCounter}-`;
}

export const EditorInstanceProvider = EditorInstanceContext.Provider;

/**
 * The id minter: `eid('crop-angle')` is this instance's id for the
 * angle slider, stable for the component's lifetime.
 */
export function useEditorId(): (name: string) => string {
	const prefix = useContext(EditorInstanceContext);

	return useCallback((name: string) => prefix + name, [prefix]);
}

/**
 * This instance's DOM root, for the focus handoffs that look elements
 * up at a distance (a deleted row's fallback, a paste's landing spot).
 * Queries resolved through it can never reach into another editor on
 * the same page. The default, `document`, keeps lone components (tests,
 * stories) working without a provider.
 */
const EditorRootContext =
	createContext<React.RefObject<HTMLElement | null> | null>(null);

export const EditorRootProvider = EditorRootContext.Provider;

export function useEditorRoot(): () => ParentNode {
	const ref = useContext(EditorRootContext);

	return useCallback(() => ref?.current ?? document, [ref]);
}
