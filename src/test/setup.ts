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
