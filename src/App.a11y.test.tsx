import {render} from '@testing-library/react';
import {axe} from 'jest-axe';

import App from './App';

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
