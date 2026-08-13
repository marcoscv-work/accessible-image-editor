/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import type {StorybookConfig} from '@storybook/react-vite';

const config: StorybookConfig = {
	framework: '@storybook/react-vite',
	stories: ['../src/**/*.stories.tsx'],

	/**
	 * GitHub Pages serves the Storybook under a sub-path; the deploy
	 * workflow sets STORYBOOK_BASE_PATH accordingly.
	 */
	async viteFinal(viteConfig) {
		return {
			...viteConfig,
			base: process.env.STORYBOOK_BASE_PATH ?? '/',
		};
	},
};

export default config;
