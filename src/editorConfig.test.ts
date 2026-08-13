/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {
	ADJUSTMENT_KEYS,
	ANNOTATE_TOOLS,
	configFromSearch,
	resolveConfig,
} from './editorConfig';
import {FILTER_PRESETS} from './imaging/FilterDefs';
import {STICKER_KINDS} from './imaging/overlayShapes';

describe('resolveConfig', () => {
	it('exposes everything by default', () => {
		const resolved = resolveConfig();

		expect(resolved.adjustments).toEqual(ADJUSTMENT_KEYS);
		expect(resolved.annotate.tools).toEqual(ANNOTATE_TOOLS);
		expect(resolved.annotate.stickers).toEqual(STICKER_KINDS);
		expect(resolved.filters).toEqual(FILTER_PRESETS);
		expect(resolved.crop).toMatchObject({
			enabled: true,
			rotate: true,
			straighten: true,
		});
	});

	it('switches a whole section off with false', () => {
		const resolved = resolveConfig({adjustments: false, annotate: false});

		expect(resolved.adjustments).toEqual([]);
		expect(resolved.annotate.tools).toEqual([]);

		// Untouched sections keep their defaults.

		expect(resolved.filters).toEqual(FILTER_PRESETS);
	});

	it('narrows a section to a subset', () => {
		const resolved = resolveConfig({
			adjustments: {sliders: ['contrast', 'brightness']},
			filters: {presets: ['sepia', 'none']},
		});

		// Canonical order wins over the order given by the caller.

		expect(resolved.adjustments).toEqual(['brightness', 'contrast']);
		expect(resolved.filters).toEqual(['none', 'sepia']);
	});

	it('ignores names that do not exist', () => {
		const resolved = resolveConfig({
			filters: {presets: ['sepia', 'nope' as never]},
		});

		expect(resolved.filters).toEqual(['sepia']);
	});

	it('turns crop features off individually', () => {
		const resolved = resolveConfig({crop: {rotate: false}});

		expect(resolved.crop).toMatchObject({
			enabled: true,
			rotate: false,
			straighten: true,
		});
	});
});

describe('configFromSearch', () => {
	it('is empty without parameters', () => {
		expect(configFromSearch('')).toEqual({});
	});

	it('reads subsets per section', () => {
		expect(
			configFromSearch('?filters=none,sepia&adjustments=brightness')
		).toEqual({
			adjustments: {sliders: ['brightness']},
			filters: {presets: ['none', 'sepia']},
		});
	});

	it('switches a section off with an empty value', () => {
		expect(configFromSearch('?annotate=')).toEqual({annotate: false});
	});

	it('reads crop features and sticker subsets', () => {
		expect(
			configFromSearch('?crop=straighten&stickers=star,heart')
		).toEqual({
			annotate: {stickers: ['star', 'heart'], tools: undefined},
			crop: {rotate: false, straighten: true},
		});
	});

	it('implies the sticker tool when stickers are listed', () => {
		const config = configFromSearch(
			'?annotate=text&stickers=star,heart'
		);

		expect(config.annotate).toEqual({
			stickers: ['star', 'heart'],
			tools: ['text', 'stickers'],
		});

		expect(resolveConfig(config).annotate).toEqual({
			stickers: ['star', 'heart'],
			tools: ['text', 'stickers'],
		});
	});
});
