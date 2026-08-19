/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import '@testing-library/jest-dom/vitest';
import {toHaveNoViolations} from 'jest-axe';

expect.extend(toHaveNoViolations);

if (!globalThis.URL.createObjectURL) {
	globalThis.URL.createObjectURL = () => 'blob:jsdom-test';
	globalThis.URL.revokeObjectURL = () => {};
}

if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = class {
		disconnect() {}
		observe() {}
		unobserve() {}
	} as unknown as typeof ResizeObserver;
}

/*
 * An unexpected console.error or console.warn is a failure, not noise: a
 * React act() violation, a missing spritemap, a bad prop type all arrive
 * through these channels, and a suite that scrolls past them green is
 * lying. A test that expects a specific message can still spy on the
 * console explicitly.
 */

const unexpected: string[] = [];

const failOn =
	(original: (...args: unknown[]) => void) =>
	(...args: unknown[]) => {
		unexpected.push(args.map(String).join(' '));

		original(...args);
	};

// eslint-disable-next-line no-console
console.error = failOn(console.error.bind(console));

// eslint-disable-next-line no-console
console.warn = failOn(console.warn.bind(console));

afterEach(() => {
	if (unexpected.length) {
		const messages = unexpected.splice(0);

		throw new Error(
			`Unexpected console output:\n${messages.join('\n')}`
		);
	}
});
