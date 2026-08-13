/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import '@clayui/css/lib/css/atlas.css';

import '../src/styles.css';

import type {Preview} from '@storybook/react-vite';

const preview: Preview = {
	parameters: {
		layout: 'fullscreen',
	},
};

export default preview;
