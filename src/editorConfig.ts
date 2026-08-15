/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {FILTER_PRESETS} from './imaging/FilterDefs';
import {STICKER_KINDS} from './imaging/overlayShapes';
import {
	Adjustments,
	FilterPreset,
	RatioPreset,
	StickerKind,
} from './state/types';

export type AdjustmentKey = keyof Adjustments;

export type AnnotateTool =
	| 'circle'
	| 'rectangle'
	| 'redaction'
	| 'stickers'
	| 'text';

export const ADJUSTMENT_KEYS: AdjustmentKey[] = [
	'brightness',
	'contrast',
	'saturation',
	'shadows',
	'highlights',
];

export const ANNOTATE_TOOLS: AnnotateTool[] = [
	'text',
	'rectangle',
	'circle',
	'redaction',
	'stickers',
];

export const RATIO_PRESETS: RatioPreset[] = [
	'custom',
	'original',
	'1:1',
	'4:3',
	'16:9',
	'3:4',
	'9:16',
];

/**
 * What the editor exposes. Every section can be switched off with
 * `false`, or narrowed to a subset of its own tools; anything omitted
 * keeps the full default, so `{}` is the complete editor.
 */
export interface EditorConfig {
	adjustments?: false | {sliders?: AdjustmentKey[]};

	annotate?:
		| false
		| {
				stickers?: StickerKind[];
				tools?: AnnotateTool[];
		  };

	crop?:
		| false
		| {
				ratios?: RatioPreset[];
				rotate?: boolean;
				straighten?: boolean;
		  };

	filters?: false | {presets?: FilterPreset[]};
}

/**
 * The normalised shape the components consume: plain lists and flags, no
 * optionals left to reason about. A section renders when its list is not
 * empty (or, for the crop, when it is enabled).
 */
export interface ResolvedEditorConfig {
	adjustments: AdjustmentKey[];
	annotate: {stickers: StickerKind[]; tools: AnnotateTool[]};
	crop: {
		enabled: boolean;
		ratios: RatioPreset[];
		rotate: boolean;
		straighten: boolean;
	};
	filters: FilterPreset[];
}

/**
 * Keeps the given items in their canonical order, so a caller cannot
 * reshuffle the UI by listing them differently.
 */
function pick<T>(all: T[], wanted?: T[]): T[] {
	if (!wanted) {
		return all;
	}

	const set = new Set(wanted);

	return all.filter((item) => set.has(item));
}

export function resolveConfig(config: EditorConfig = {}): ResolvedEditorConfig {
	const annotate = config.annotate;
	const crop = config.crop;

	return {
		adjustments:
			config.adjustments === false
				? []
				: pick(ADJUSTMENT_KEYS, config.adjustments?.sliders),
		annotate:
			annotate === false
				? {stickers: [], tools: []}
				: {
						stickers: pick(STICKER_KINDS, annotate?.stickers),
						tools: pick(ANNOTATE_TOOLS, annotate?.tools),
					},
		crop:
			crop === false
				? {enabled: false, ratios: [], rotate: false, straighten: false}
				: {
						enabled: true,
						ratios: pick(RATIO_PRESETS, crop?.ratios),
						rotate: crop?.rotate ?? true,
						straighten: crop?.straighten ?? true,
					},
		filters:
			config.filters === false
				? []
				: pick(FILTER_PRESETS, config.filters?.presets),
	};
}

function list(value: string | null): string[] | undefined {
	if (value === null) {
		return undefined;
	}

	return value
		.split(',')
		.map((name) => name.trim().toLowerCase())
		.filter(Boolean);
}

/**
 * Reads a configuration from the URL so a hosted build can be tried in
 * any combination without a code change, for example
 * `?crop=straighten&filters=none,sepia&adjustments=brightness`.
 * An empty value switches a section off (`?annotate=`).
 */
export function configFromSearch(search: string): EditorConfig {
	const params = new URLSearchParams(search);

	const config: EditorConfig = {};

	const adjustments = list(params.get('adjustments'));

	if (adjustments) {
		config.adjustments = adjustments.length
			? {sliders: adjustments as AdjustmentKey[]}
			: false;
	}

	const filters = list(params.get('filters'));

	if (filters) {
		config.filters = filters.length
			? {presets: filters as FilterPreset[]}
			: false;
	}

	const annotate = list(params.get('annotate'));

	if (annotate) {
		config.annotate = annotate.length
			? {tools: annotate as AnnotateTool[]}
			: false;
	}

	const stickers = list(params.get('stickers'));

	if (stickers?.length && config.annotate !== false) {
		const current = config.annotate ?? {};

		// Naming stickers implies wanting the sticker tool, even when the
		// tool list did not mention it.

		config.annotate = {
			...current,
			stickers: stickers as StickerKind[],
			tools: current.tools
				? [...new Set([...current.tools, 'stickers' as AnnotateTool])]
				: undefined,
		};
	}

	const crop = list(params.get('crop'));

	if (crop) {
		config.crop = crop.length
			? {
					rotate: crop.includes('rotate'),
					straighten: crop.includes('straighten'),
				}
			: false;
	}

	return config;
}
