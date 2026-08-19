/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {Overlay} from './types';

type Kind = Overlay['kind'];

/**
 * What a patch may touch, per kind. `id` and `kind` are identity, never
 * data, and a key another kind owns (points on a shape, text on an
 * arrow) is dropped rather than smuggled in: the state's shape is the
 * reducer's to defend, not the dispatcher's to extend.
 */
const EDITABLE_KEYS: {[K in Kind]: ReadonlySet<string>} = {
	arrow: new Set([
		'color',
		'dx',
		'dy',
		'head',
		'opacity',
		'thickness',
		'x',
		'y',
	]),
	circle: new Set([
		'borderColor',
		'borderWidth',
		'color',
		'height',
		'opacity',
		'rotation',
		'sketchSeed',
		'width',
		'x',
		'y',
	]),
	emoji: new Set(['character', 'name', 'opacity', 'rotation', 'size', 'x', 'y']),
	image: new Set([
		'description',
		'height',
		'opacity',
		'rotation',
		'src',
		'width',
		'x',
		'y',
	]),
	redact: new Set([
		'height',
		'level',
		'opacity',
		'rotation',
		'style',
		'width',
		'x',
		'y',
	]),
	shape: new Set([
		'borderColor',
		'borderWidth',
		'color',
		'height',
		'opacity',
		'rotation',
		'sketchSeed',
		'width',
		'x',
		'y',
	]),
	stroke: new Set([
		'color',
		'opacity',
		'points',
		'rotation',
		'smooth',
		'width',
		'x',
		'y',
	]),
	text: new Set([
		'color',
		'fontFamily',
		'fontSize',
		'opacity',
		'rotation',
		'text',
		'x',
		'y',
	]),
};

const STRING_KEYS = new Set([
	'borderColor',
	'character',
	'color',
	'description',
	'fontFamily',
	'name',
	'src',
	'text',
]);

const ENUM_KEYS: Record<string, ReadonlySet<string>> = {
	head: new Set(['filled', 'open']),
	level: new Set(['coarse', 'fine', 'medium', 'tiny']),
	style: new Set(['blur', 'pixel']),
};

/**
 * Optional keys a patch may clear by carrying an explicit `undefined`:
 * removing the sketch seed is how a shape returns to the clean style.
 */
const CLEARABLE_KEYS = new Set(['borderColor', 'borderWidth', 'sketchSeed']);

/**
 * Dimensions that make no sense at zero or below: a 0x0 shape cannot be
 * grabbed again and a 0 font draws nothing to select.
 */
const AT_LEAST_ONE = new Set([
	'fontSize',
	'height',
	'size',
	'thickness',
	'width',
]);

function validate(key: string, value: unknown): unknown {
	if (key === 'smooth') {
		return typeof value === 'boolean' ? value : undefined;
	}

	if (key === 'points') {
		return Array.isArray(value) &&
			value.length >= 2 &&
			value.every((entry) => Number.isFinite(entry))
			? value
			: undefined;
	}

	if (ENUM_KEYS[key]) {
		return typeof value === 'string' && ENUM_KEYS[key].has(value)
			? value
			: undefined;
	}

	if (STRING_KEYS.has(key)) {
		return typeof value === 'string' ? value : undefined;
	}

	// Everything else is a number. NaN and infinities never enter the
	// state: a field mid-edit can produce them, the picture cannot.

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}

	if (key === 'opacity') {
		return Math.min(100, Math.max(0, value));
	}

	// The stroke's `width` is its weight, not a box side; same floor.

	if (AT_LEAST_ONE.has(key)) {
		return Math.max(1, value);
	}

	return value;
}

/**
 * The overlay with a patch applied: unknown keys dropped, values checked
 * against the key's domain, numbers clamped. Returns the same reference
 * when nothing survives or nothing differs, which is what lets the
 * reducer skip the history entry entirely.
 */
export function patchOverlay(overlay: Overlay, patch: Partial<Overlay>): Overlay {
	const allowed = EDITABLE_KEYS[overlay.kind];

	let next: Overlay | null = null;

	for (const [key, raw] of Object.entries(patch)) {
		if (!allowed.has(key)) {
			continue;
		}

		const clearing = raw === undefined && CLEARABLE_KEYS.has(key);

		const value = clearing ? undefined : validate(key, raw);

		if (value === undefined && !clearing) {
			continue;
		}

		if ((overlay as unknown as Record<string, unknown>)[key] === value) {
			continue;
		}

		if (!next) {
			next = {...overlay};
		}

		// The key is in this kind's whitelist and the value passed its
		// domain check: the assignment is sound, the annotation is just
		// invisible to the compiler across a union.

		(next as unknown as Record<string, unknown>)[key] = value;
	}

	return next ?? overlay;
}
