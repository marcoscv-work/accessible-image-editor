/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {render} from '@testing-library/react';
import {axe} from 'jest-axe';

import '@testing-library/jest-dom';

import App from '../src/App';

describe('App landing view', () => {
	it('has no axe violations', async () => {
		const {container} = render(<App />);

		expect(await axe(container)).toHaveNoViolations();
	});

	it('exposes the two open actions as buttons', () => {
		const {getByRole} = render(<App />);

		expect(
			getByRole('button', {name: 'Edit sample image'})
		).toBeInTheDocument();
		expect(
			getByRole('button', {name: 'Open an image from your device'})
		).toBeInTheDocument();
	});
});
