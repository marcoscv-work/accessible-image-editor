/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {renderEditor} from '../test/renderEditor';
import {BottomBar} from './BottomBar';
import {EditorInstanceProvider, nextEditorInstancePrefix} from './instance';

/**
 * AIE-006: two editors on one page must not cross-wire. Every id is
 * minted through the instance prefix, so labels, descriptions and radio
 * groups stay with their own editor.
 */

function bar(ratio: '1:1' | 'original') {
	return (
		<BottomBar
			canRedo={false}
			canUndo={false}
			dispatch={() => {}}
			onAnnounce={() => {}}
			onCancel={() => {}}
			onRedo={() => {}}
			onSave={() => {}}
			onShowShortcuts={() => {}}
			onUndo={() => {}}
			onZoom={() => {}}
			onZoomFit={() => {}}
			ratio={ratio}
			ratios={['original', '1:1']}
			saving={false}
			showRotate
			zoom={1}
		/>
	);
}

describe('per-instance ids', () => {
	it('mints a fresh prefix per call', () => {
		expect(nextEditorInstancePrefix()).not.toBe(
			nextEditorInstancePrefix()
		);
	});

	it('keeps two instances distinct and both label associations sound', () => {
		renderEditor(
			<>
				<EditorInstanceProvider value="one-">
					{bar('1:1')}
				</EditorInstanceProvider>
				<EditorInstanceProvider value="two-">
					{bar('original')}
				</EditorInstanceProvider>
			</>
		);

		const selects = screen.getAllByLabelText('Ratio') as HTMLSelectElement[];

		// Both labels resolve, to different controls with different ids,
		// and each shows its own editor's value.

		expect(selects).toHaveLength(2);
		expect(selects[0].id).toBe('one-crop-ratio-select');
		expect(selects[1].id).toBe('two-crop-ratio-select');
		expect(selects[0].value).toBe('1:1');
		expect(selects[1].value).toBe('original');
	});
});
