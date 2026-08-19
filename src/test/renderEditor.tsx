/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayIconSpriteContext} from '@clayui/icon';
import {RenderResult, render} from '@testing-library/react';
import React from 'react';

import {AnnouncerProvider} from '../components/Announcer';
import {EditorInstanceProvider} from '../components/instance';

/**
 * Renders editor components under the same providers the public root
 * mounts, so a harness exercises what a host would actually get: a
 * spritemap for the icons, a live announcer region, and an instance
 * prefix for the ids. Nothing in a test should hand-roll these.
 */
export function renderEditor(ui: React.ReactElement): RenderResult {
	return render(
		<ClayIconSpriteContext.Provider value="/icons.svg">
			<AnnouncerProvider>
				<EditorInstanceProvider value="aie-">
					{ui}
				</EditorInstanceProvider>
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
