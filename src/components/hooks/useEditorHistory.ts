/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useEffect, useReducer, useRef} from 'react';

import {ResolvedEditorConfig} from '../../editorConfig';
import {t} from '../../i18n';
import {LoadedImage} from '../../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
	redoLabel,
	undoLabel,
} from '../../state/editorReducer';

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
	announce: (message: string) => void
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

		if (!label) {
			return;
		}

		dispatch({type: 'undo'});

		announce(t('undo-done', label));
	};

	const redo = () => {
		const label = redoLabel(history);

		if (!label) {
			return;
		}

		dispatch({type: 'redo'});

		announce(t('redo-done', label));
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

	undoRef.current = {redo, undo};

	// The React handler above only hears keys pressed inside the editor.
	// Focus can still escape it for a moment, and the undo someone
	// presses in that moment must not vanish: the document catches what
	// the editor did not already see.

	useEffect(() => {
		const catchStray = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLowerCase() !== 'z' ||
				(event.target instanceof Node &&
					editorRef.current?.contains(event.target))
			) {
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

		document.addEventListener('keydown', catchStray);

		return () => document.removeEventListener('keydown', catchStray);
	}, []);

	return {dispatch, editorRef, handleUndoShortcut, history, redo, undo};
}
