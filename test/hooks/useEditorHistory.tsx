/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {fireEvent, screen} from '@testing-library/react';

import '@testing-library/jest-dom';

import {resolveConfig} from '../../src/editorConfig';
import {useEditorHistory} from '../../src/hooks/useEditorHistory';
import {LoadedImage} from '../../src/imaging/loadImage';
import {renderEditor} from '../__lib__/renderEditor';

const IMAGE: LoadedImage = {
	blob: new Blob(),
	fileName: 'test.jpg',
	height: 800,
	pixelUrls: {
		coarse: 'c.png',
		fine: 'f.png',
		medium: 'm.png',
		tiny: 't.png',
	},
	previewUrl: 'test.jpg',
	thumbUrl: 'thumb.jpg',
	type: 'image/jpeg',
	width: 1200,
};

const ENABLED = resolveConfig({});

/**
 * Two of these mounted side by side are two real histories: each has its
 * own reducer, its own editor node, and its own claim on the document
 * fallback.
 */
function Harness({label}: {label: string}) {
	const {dispatch, editorRef, handleUndoShortcut, history} =
		useEditorHistory(IMAGE, ENABLED, () => {});

	return (
		<div
			aria-label={`editor-${label}`}
			onKeyDown={handleUndoShortcut}
			ref={editorRef}
			role="group"
			tabIndex={0}
		>
			<button
				onClick={() =>
					dispatch({
						key: 'brightness',
						type: 'set-adjustment',
						value: 5,
					})
				}
			>
				{`edit-${label}`}
			</button>

			<output>{String(history.present.adjustments.brightness)}</output>
		</div>
	);
}

const editor = (label: string) => screen.getByRole('group', {name: `editor-${label}`});

const brightness = (label: string) =>
	editor(label).querySelector('output')!.textContent;

describe('the undo fallback with two instances (R2-001)', () => {
	it('undoes only in the editor the keystroke belongs to', () => {
		renderEditor(
			<>
				<Harness label="a" />
				<Harness label="b" />
			</>
		);

		fireEvent.click(screen.getByRole('button', {name: 'edit-a'}));
		fireEvent.click(screen.getByRole('button', {name: 'edit-b'}));

		expect(brightness('a')).toBe('5');
		expect(brightness('b')).toBe('5');

		// A keystroke inside A: A's own handler takes it, and B's
		// document fallback must not echo it.

		fireEvent.keyDown(editor('a'), {ctrlKey: true, key: 'z'});

		expect(brightness('a')).toBe('0');
		expect(brightness('b')).toBe('5');
	});

	it('routes a stray keystroke to the last active editor only', () => {
		renderEditor(
			<>
				<Harness label="a" />
				<Harness label="b" />
			</>
		);

		fireEvent.click(screen.getByRole('button', {name: 'edit-a'}));
		fireEvent.click(screen.getByRole('button', {name: 'edit-b'}));

		// The user touches B last, then focus falls to the body (a
		// focused node unmounting does that): the stray undo belongs to
		// B, and only B.

		fireEvent.pointerDown(editor('b'));

		fireEvent.keyDown(document.body, {ctrlKey: true, key: 'z'});

		expect(brightness('a')).toBe('5');
		expect(brightness('b')).toBe('0');

		// Touching A hands the net over: the next stray undo is A's.

		fireEvent.pointerDown(editor('a'));

		fireEvent.keyDown(document.body, {ctrlKey: true, key: 'z'});

		expect(brightness('a')).toBe('0');
		expect(brightness('b')).toBe('0');
	});
});
