/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {useRef} from 'react';

import {t} from '../../i18n';
import {overlayLabel} from '../../imaging/overlayShapes';
import {EditorAction} from '../../state/editorReducer';
import {nextId} from '../../state/ids';
import {EditState, Overlay} from '../../state/types';

/**
 * The editor-internal clipboard: copy takes a snapshot of the annotation,
 * paste lands it slightly offset, selects it, focuses it, and cascades,
 * so paste-paste-paste walks a diagonal instead of stacking invisibly.
 * Editor-internal on purpose: annotations are parametric objects, not
 * pixels, and the system clipboard cannot carry them faithfully.
 */
export function useOverlayClipboard(
	state: EditState,
	dispatch: (action: EditorAction) => void,
	onPasteSelect: (id: string) => void,
	announce: (message: string) => void,

	/**
	 * Where the pasted annotation's focus handoff looks the node up:
	 * this editor's root, never the page.
	 */
	root: () => ParentNode
) {
	const clipboardRef = useRef<Overlay | null>(null);

	const copyOverlay = (id: string) => {
		const overlay = state.overlays.find(
			(candidate) => candidate.id === id
		);

		if (!overlay) {
			return;
		}

		clipboardRef.current = {...overlay};

		announce(t('x-copied', overlayLabel(overlay)));
	};

	const pasteOverlay = () => {
		const copied = clipboardRef.current;

		if (!copied) {
			return;
		}

		const offset = Math.round(
			Math.max(
				16,
				Math.min(state.sourceWidth, state.sourceHeight) * 0.02
			)
		);

		const overlay: Overlay = {
			...copied,
			id: nextId(copied.kind),
			x: copied.x + offset,
			y: copied.y + offset,
		};

		// The cascade: the next paste starts from this one.

		clipboardRef.current = overlay;

		dispatch({overlay, type: 'add-overlay'});

		onPasteSelect(overlay.id);

		announce(t('x-pasted', overlayLabel(overlay)));

		window.setTimeout(() => {
			root()
				.querySelector<HTMLElement>(
					`[data-overlay-id="${overlay.id}"]`
				)
				?.focus({preventScroll: true});
		}, 0);
	};

	return {copyOverlay, pasteOverlay};
}
