/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useEffect, useReducer, useRef} from 'react';

import {ResolvedEditorConfig} from '../editorConfig';
import {t} from '../i18n';
import {LoadedImage} from '../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
	redoLabel,
	undoLabel,
} from '../state/editorReducer';

/**
 * The editor whose undo net the document-level fallback belongs to right
 * now. Module-scoped on purpose: "which editor did the user touch last"
 * is a fact about the page, not about any one instance, and it is what
 * keeps a stray Ctrl/Cmd+Z from undoing in every editor at once. The
 * registry of mounted editors is what lets a lone instance keep the net
 * before anything has been touched.
 */
let lastActiveEditor: HTMLElement | null = null;

const mountedEditors = new Set<object>();

/**
 * The parametric state and its undo machinery: the reducer, the labelled
 * undo/redo pair that announces what it reverts, the editor-scoped
 * shortcut handler, and the document-level fallback that catches the
 * keystroke when focus momentarily escapes the editor (a focused node
 * that unmounts drops focus on the body).
 */
export function useEditorHistory(
	image: LoadedImage,
	enabled: ResolvedEditorConfig,
	announce: (message: string) => void,

	/**
	 * When this reports true, the undo net stays quiet: a save in
	 * flight must not have history changed underneath the snapshot it
	 * is persisting.
	 */
	frozen?: () => boolean
) {
	const [history, dispatch] = useReducer(editorReducer, undefined, () =>

		// Born inside the configuration: a host offering only sepia gets
		// an editor whose state starts on sepia, not one whose gallery
		// shows no selection. The config is immutable for the session,
		// which is what makes the one-time init sound.

		initialHistory(image.width, image.height, {
			filters: enabled.filters,
			frames: enabled.frames,
			ratios: enabled.crop.ratios,
		})
	);

	const undo = () => {
		const label = undoLabel(history);

		if (!label || frozen?.()) {
			return;
		}

		dispatch({type: 'undo'});

		announce(t('undo-x', label));
	};

	const redo = () => {
		const label = redoLabel(history);

		if (!label || frozen?.()) {
			return;
		}

		dispatch({type: 'redo'});

		announce(t('redo-x', label));
	};

	const handleUndoShortcut = (event: React.KeyboardEvent) => {
		if (
			!(event.metaKey || event.ctrlKey) ||
			event.key.toLowerCase() !== 'z'
		) {
			return;
		}

		event.preventDefault();

		if (event.shiftKey) {
			redo();
		}
		else {
			undo();
		}
	};

	const editorRef = useRef<HTMLDivElement | null>(null);

	const undoRef = useRef({redo, undo});

	useEffect(() => {
		undoRef.current = {redo, undo};
	});

	// The React handler above only hears keys pressed inside the editor.
	// Focus can still escape it for a moment, and the undo someone
	// presses in that moment must not vanish: the document catches what
	// the editor did not already see. Only for the editor the user
	// touched last, though: with two instances mounted, a keystroke that
	// belongs to one must never be undone by the other.
	//
	// Everything reads editorRef.current lazily: the modal renders its
	// children a commit after this effect runs, so the node does not
	// exist yet when the listeners are installed.

	useEffect(() => {
		const token = {};

		mountedEditors.add(token);

		// The claims run in the capture phase, so the editor that
		// physically contains an event owns the net before any bubble
		// phase document listener asks whose stray key it was.

		let claimed: HTMLElement | null = null;

		const claim = (event: Event) => {
			const node = editorRef.current;

			if (
				node &&
				event.target instanceof Node &&
				node.contains(event.target)
			) {
				claimed = node;
				lastActiveEditor = node;
			}
		};

		const catchStray = (event: KeyboardEvent) => {
			const node = editorRef.current;

			if (
				!node ||
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLowerCase() !== 'z' ||
				(event.target instanceof Node && node.contains(event.target))
			) {
				return;
			}

			// Mine when the user touched this editor last, or when this
			// is the only editor on the page and nothing has been
			// touched yet.

			const mine =
				lastActiveEditor === node ||
				(lastActiveEditor === null && mountedEditors.size === 1);

			if (!mine) {
				return;
			}

			event.preventDefault();

			if (event.shiftKey) {
				undoRef.current.redo();
			}
			else {
				undoRef.current.undo();
			}
		};

		document.addEventListener('focusin', claim, true);
		document.addEventListener('pointerdown', claim, true);
		document.addEventListener('keydown', claim, true);
		document.addEventListener('keydown', catchStray);

		return () => {
			mountedEditors.delete(token);

			document.removeEventListener('focusin', claim, true);
			document.removeEventListener('pointerdown', claim, true);
			document.removeEventListener('keydown', claim, true);
			document.removeEventListener('keydown', catchStray);

			// The net is released for whatever node this editor claimed
			// during its life; the claim listeners tracked it so the
			// cleanup does not have to consult the ref.

			if (claimed && lastActiveEditor === claimed) {
				lastActiveEditor = null;
			}
		};
	}, []);

	return {dispatch, editorRef, handleUndoShortcut, history, redo, undo};
}
