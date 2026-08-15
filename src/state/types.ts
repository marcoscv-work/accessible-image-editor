/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface CropRect {
	height: number;
	width: number;
	x: number;
	y: number;
}

export interface Adjustments {
	brightness: number;
	contrast: number;
	highlights: number;
	saturation: number;
	shadows: number;
}

export type FilterPreset =
	| 'bleach'
	| 'cool'
	| 'crossprocess'
	| 'cyanotype'
	| 'fade'
	| 'grayscale'
	| 'invert'
	| 'matte'
	| 'noir'
	| 'none'
	| 'polaroid'
	| 'posterize'
	| 'sepia'
	| 'solarize'
	| 'splittone'
	| 'tealorange'
	| 'technicolor'
	| 'vintage'
	| 'vivid'
	| 'warm';

export type RatioPreset =
	| '1:1'
	| '16:9'
	| '3:4'
	| '4:3'
	| '9:16'
	| 'custom'
	| 'original';

export interface TextOverlay {
	color: string;
	fontFamily: string;
	fontSize: number;
	id: string;
	kind: 'text';
	opacity?: number;
	rotation?: number;
	text: string;
	x: number;
	y: number;
}

export interface CircleOverlay {

	/**
	 * Optional outline. No border is drawn unless a width is set, which is
	 * what keeps a new shape flat by default.
	 */
	borderColor?: string;
	borderWidth?: number;
	color: string;
	height: number;
	id: string;
	kind: 'circle';
	opacity?: number;
	rotation?: number;
	width: number;
	x: number;
	y: number;
}

export interface ShapeOverlay {

	/**
	 * Optional outline. No border is drawn unless a width is set, which is
	 * what keeps a new shape flat by default.
	 */
	borderColor?: string;
	borderWidth?: number;
	color: string;
	height: number;
	id: string;
	kind: 'shape';
	opacity?: number;
	rotation?: number;
	width: number;
	x: number;
	y: number;
}

export type StickerKind =
	| 'arrow'
	| 'bolt'
	| 'check'
	| 'cool'
	| 'heart'
	| 'laugh'
	| 'love'
	| 'sad'
	| 'smiley'
	| 'star';

export interface StickerOverlay {
	color: string;
	id: string;
	kind: 'sticker';
	opacity?: number;
	rotation?: number;
	size: number;
	sticker: StickerKind;
	x: number;
	y: number;
}

/**
 * A picture the user brings in: a logo, a signature, a badge. The bitmap
 * travels in the state as a data URL rather than an object URL, because
 * the export rasterizes its SVG through an `img`, which runs in secure
 * static mode and cannot load `blob:` subresources.
 */
export interface ImageOverlay {

	/**
	 * What the picture shows. Seeded from the file name and editable,
	 * because a file called `logo-v3-final.png` names a file, not a
	 * picture, and this is the annotation's accessible name.
	 */
	description: string;

	height: number;
	id: string;
	kind: 'image';
	opacity?: number;
	rotation?: number;
	src: string;
	width: number;
	x: number;
	y: number;
}

export type RedactLevel = 'coarse' | 'fine' | 'medium' | 'tiny';

/**
 * A pixelated block: same geometry as a rectangle, but instead of a fill
 * it reveals a heavily downsampled copy of the image underneath.
 */
export interface RedactOverlay {
	height: number;
	id: string;
	kind: 'redact';
	level: RedactLevel;
	opacity?: number;
	rotation?: number;
	width: number;
	x: number;
	y: number;
}

export type Overlay =
	| RedactOverlay
	| CircleOverlay
	| ImageOverlay
	| ShapeOverlay
	| StickerOverlay
	| TextOverlay;

/**
 * Overlays whose geometry is a box, so they share the free-stretch edge
 * handles and the width/height properties.
 */
export function isBoxOverlay(
	overlay: Overlay
): overlay is CircleOverlay | ImageOverlay | RedactOverlay | ShapeOverlay {
	return (
		overlay.kind === 'circle' ||
		overlay.kind === 'image' ||
		overlay.kind === 'redact' ||
		overlay.kind === 'shape'
	);
}

/**
 * The whole edit session as plain, serializable data. Every operation the
 * user performs mutates nothing: it produces a new EditState through the
 * reducer, and the preview and the export are both pure projections of it.
 */
export interface EditState {
	adjustments: Adjustments;

	/**
	 * Free rotation in degrees (straighten), on top of the quarter turns
	 * in `rotation`. The image is scaled just enough to keep covering the
	 * frame, so no empty corners appear and the crop coordinate space is
	 * unaffected.
	 */
	angle: number;
	crop: CropRect;
	filter: FilterPreset;

	/**
	 * Mirrors the composition horizontally. Applied last, so it mirrors
	 * whatever the quarter turns and the straighten angle produced, which
	 * is what flipping a photograph is expected to do.
	 */
	flipHorizontal: boolean;
	overlays: Overlay[];
	ratio: RatioPreset;
	rotation: Rotation;
	sourceHeight: number;
	sourceWidth: number;
}

/**
 * A history entry stores the state a change departed from and a human
 * label describing that change, so undo/redo can announce what they did.
 */
export interface HistoryEntry {
	label: string;
	state: EditState;
}

export interface EditorHistory {
	future: HistoryEntry[];
	past: HistoryEntry[];

	/**
	 * Set while a transient gesture (slider drag, handle drag) is in
	 * progress: the committed state the gesture started from plus the
	 * gesture's label. The commit pushes it to `past` exactly once, so a
	 * whole drag is a single undo step.
	 */
	pendingBase?: HistoryEntry;

	present: EditState;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
	brightness: 0,
	contrast: 0,
	highlights: 0,
	saturation: 0,
	shadows: 0,
};

export const MIN_CROP_SIZE = 16;

/**
 * Size of the image after rotation, in original-image pixels. This is the
 * coordinate space of the crop rectangle and the overlays.
 */
export function rotatedSize(state: EditState): {
	height: number;
	width: number;
} {
	return state.rotation % 180 === 0
		? {height: state.sourceHeight, width: state.sourceWidth}
		: {height: state.sourceWidth, width: state.sourceHeight};
}

export const RATIO_VALUES: Record<
	Exclude<RatioPreset, 'custom' | 'original'>,
	number
> = {
	'1:1': 1,
	'3:4': 3 / 4,
	'4:3': 4 / 3,
	'9:16': 9 / 16,
	'16:9': 16 / 9,
};
