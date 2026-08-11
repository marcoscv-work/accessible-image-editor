/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {t} from '../i18n';
import {
	Adjustments,
	CropRect,
	DEFAULT_ADJUSTMENTS,
	EditState,
	EditorHistory,
	FilterPreset,
	MIN_CROP_SIZE,
	Overlay,
	RATIO_VALUES,
	RatioPreset,
	rotatedSize,
} from './types';

export type EditorAction =
	| {type: 'add-overlay'; overlay: Overlay}
	| {id: string; newId: string; type: 'duplicate-overlay'}
	| {type: 'move-overlay-layer'; direction: -1 | 1; id: string}
	| {type: 'redo'}
	| {type: 'remove-overlay'; id: string}
	| {type: 'reset-adjustments'}
	| {
			key: keyof Adjustments;
			transient?: boolean;
			type: 'set-adjustment';
			value: number;
	  }
	| {crop: CropRect; transient?: boolean; type: 'set-crop'}
	| {filter: FilterPreset; type: 'set-filter'}
	| {ratio: RatioPreset; type: 'set-ratio'}
	| {type: 'rotate-90'}
	| {
			id: string;
			patch: Partial<Overlay>;
			transient?: boolean;
			type: 'update-overlay';
	  }
	| {type: 'undo'};

export function initialEditState(
	sourceWidth: number,
	sourceHeight: number
): EditState {
	return {
		adjustments: {...DEFAULT_ADJUSTMENTS},
		crop: {height: sourceHeight, width: sourceWidth, x: 0, y: 0},
		filter: 'none',
		overlays: [],
		ratio: 'original',
		rotation: 0,
		sourceHeight,
		sourceWidth,
	};
}

export function initialHistory(
	sourceWidth: number,
	sourceHeight: number
): EditorHistory {
	return {
		future: [],
		past: [],
		present: initialEditState(sourceWidth, sourceHeight),
	};
}

export function clampCrop(crop: CropRect, state: EditState): CropRect {
	const bounds = rotatedSize(state);

	const width = Math.min(
		Math.max(Math.round(crop.width), MIN_CROP_SIZE),
		bounds.width
	);
	const height = Math.min(
		Math.max(Math.round(crop.height), MIN_CROP_SIZE),
		bounds.height
	);
	const x = Math.min(Math.max(Math.round(crop.x), 0), bounds.width - width);
	const y = Math.min(
		Math.max(Math.round(crop.y), 0),
		bounds.height - height
	);

	return {height, width, x, y};
}

function centeredCrop(state: EditState, ratio: number): CropRect {
	const bounds = rotatedSize(state);

	let width = bounds.width;
	let height = width / ratio;

	if (height > bounds.height) {
		height = bounds.height;
		width = height * ratio;
	}

	return clampCrop(
		{
			height,
			width,
			x: (bounds.width - width) / 2,
			y: (bounds.height - height) / 2,
		},
		state
	);
}

/**
 * Label of the operation an undo would revert right now, or null when
 * there is nothing to undo. Used by the UI to announce "Undo: {label}".
 */
export function undoLabel(history: EditorHistory): string | null {
	if (history.pendingBase) {
		return history.pendingBase.label;
	}

	return history.past.length
		? history.past[history.past.length - 1].label
		: null;
}

export function redoLabel(history: EditorHistory): string | null {
	return history.future.length ? history.future[0].label : null;
}

function applyEdit(
	history: EditorHistory,
	next: EditState,
	label: string,
	transient?: boolean
): EditorHistory {
	if (transient) {
		return {
			...history,
			pendingBase: history.pendingBase ?? {
				label,
				state: history.present,
			},
			present: next,
		};
	}

	const base = history.pendingBase ?? {label, state: history.present};

	return {
		future: [],
		past: [...history.past, {label, state: base.state}],
		pendingBase: undefined,
		present: next,
	};
}

function cropsEqual(a: CropRect, b: CropRect): boolean {
	return (
		a.height === b.height &&
		a.width === b.width &&
		a.x === b.x &&
		a.y === b.y
	);
}

export function editorReducer(
	history: EditorHistory,
	action: EditorAction
): EditorHistory {
	const {present} = history;

	switch (action.type) {
		case 'set-crop': {
			const crop = clampCrop(action.crop, present);

			// A non-transient set-crop outside a gesture that changes
			// nothing (e.g. a field blur re-committing the same value)
			// must not create a history entry.

			if (
				!action.transient &&
				!history.pendingBase &&
				cropsEqual(crop, present.crop)
			) {
				return history;
			}

			return applyEdit(
				history,
				{
					...present,
					crop,
					ratio: cropsEqual(crop, present.crop)
						? present.ratio
						: 'custom',
				},
				t('label-crop'),
				action.transient
			);
		}

		case 'set-ratio': {
			let crop = present.crop;

			if (action.ratio === 'original') {
				const bounds = rotatedSize(present);

				crop = {
					height: bounds.height,
					width: bounds.width,
					x: 0,
					y: 0,
				};
			}
			else if (action.ratio !== 'custom') {
				crop = centeredCrop(present, RATIO_VALUES[action.ratio]);
			}

			return applyEdit(
				history,
				{...present, crop, ratio: action.ratio},
				t('label-ratio')
			);
		}

		case 'rotate-90': {
			const next: EditState = {
				...present,
				rotation: ((present.rotation + 90) %
					360) as EditState['rotation'],
			};

			const bounds = rotatedSize(next);

			return applyEdit(
				history,
				{
					...next,
					crop: {
						height: bounds.height,
						width: bounds.width,
						x: 0,
						y: 0,
					},
					ratio: 'original',
				},
				t('label-rotate')
			);
		}

		case 'set-adjustment': {
			if (
				!action.transient &&
				!history.pendingBase &&
				present.adjustments[action.key] === action.value
			) {
				return history;
			}

			return applyEdit(
				history,
				{
					...present,
					adjustments: {
						...present.adjustments,
						[action.key]: action.value,
					},
				},
				t('label-adjustments'),
				action.transient
			);
		}

		case 'reset-adjustments': {
			return applyEdit(
				history,
				{...present, adjustments: {...DEFAULT_ADJUSTMENTS}},
				t('label-adjustments')
			);
		}

		case 'set-filter': {
			return applyEdit(
				history,
				{...present, filter: action.filter},
				t('label-filter')
			);
		}

		case 'add-overlay': {
			return applyEdit(
				history,
				{...present, overlays: [...present.overlays, action.overlay]},
				t('label-annotation')
			);
		}

		case 'duplicate-overlay': {
			const index = present.overlays.findIndex(
				(overlay) => overlay.id === action.id
			);

			if (index < 0) {
				return history;
			}

			const source = present.overlays[index];

			// Offset the clone diagonally so it lands visibly on top of
			// the original: 2% of the smaller image side, at least 16px.

			const offset = Math.round(
				Math.max(
					16,
					Math.min(present.sourceWidth, present.sourceHeight) * 0.02
				)
			);

			const clone: Overlay = {
				...source,
				id: action.newId,
				x: source.x + offset,
				y: source.y + offset,
			};

			const overlays = [...present.overlays];

			// Right after the original: painted directly above it.

			overlays.splice(index + 1, 0, clone);

			return applyEdit(
				history,
				{...present, overlays},
				t('label-annotation')
			);
		}

		case 'update-overlay': {
			const target = present.overlays.find(
				(overlay) => overlay.id === action.id
			);

			if (!target) {
				return history;
			}

			if (
				!action.transient &&
				!history.pendingBase &&
				Object.entries(action.patch).every(
					([key, value]) =>
						target[key as keyof Overlay] === value
				)
			) {
				return history;
			}

			return applyEdit(
				history,
				{
					...present,
					overlays: present.overlays.map((overlay) =>
						overlay.id === action.id
							? ({...overlay, ...action.patch} as Overlay)
							: overlay
					),
				},
				t('label-annotation'),
				action.transient
			);
		}

		case 'remove-overlay': {
			return applyEdit(
				history,
				{
					...present,
					overlays: present.overlays.filter(
						(overlay) => overlay.id !== action.id
					),
				},
				t('label-annotation')
			);
		}

		case 'move-overlay-layer': {
			const index = present.overlays.findIndex(
				(overlay) => overlay.id === action.id
			);
			const target = index + action.direction;

			if (index < 0 || target < 0 || target >= present.overlays.length) {
				return history;
			}

			const overlays = [...present.overlays];

			[overlays[index], overlays[target]] = [
				overlays[target],
				overlays[index],
			];

			return applyEdit(
				history,
				{...present, overlays},
				t('label-layer-order')
			);
		}

		case 'undo': {
			if (history.pendingBase) {
				return {
					...history,
					pendingBase: undefined,
					present: history.pendingBase.state,
				};
			}

			if (!history.past.length) {
				return history;
			}

			const past = [...history.past];
			const entry = past.pop()!;

			return {
				future: [
					{label: entry.label, state: history.present},
					...history.future,
				],
				past,
				present: entry.state,
			};
		}

		case 'redo': {
			if (!history.future.length) {
				return history;
			}

			const [entry, ...future] = history.future;

			return {
				future,
				past: [
					...history.past,
					{label: entry.label, state: history.present},
				],
				present: entry.state,
			};
		}

		default: {
			return history;
		}
	}
}
