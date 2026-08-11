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
	| 'cool'
	| 'grayscale'
	| 'invert'
	| 'noir'
	| 'none'
	| 'sepia'
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

export interface ShapeOverlay {
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
	| 'heart'
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

export type Overlay = ShapeOverlay | StickerOverlay | TextOverlay;

/**
 * The whole edit session as plain, serializable data. Every operation the
 * user performs mutates nothing: it produces a new EditState through the
 * reducer, and the preview and the export are both pure projections of it.
 */
export interface EditState {
	adjustments: Adjustments;
	crop: CropRect;
	filter: FilterPreset;
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
	'16:9': 16 / 9,
	'3:4': 3 / 4,
	'4:3': 4 / 3,
	'9:16': 9 / 16,
};
