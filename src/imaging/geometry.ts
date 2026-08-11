import {EditState} from '../state/types';

/**
 * SVG transform that maps the unrotated source image into the rotated
 * coordinate space used by the crop rectangle and the overlays. Shared by
 * the live preview and the export pipeline so both render identically.
 */
export function rotationTransform(
	state: Pick<EditState, 'rotation' | 'sourceHeight' | 'sourceWidth'>
): string | undefined {
	switch (state.rotation) {
		case 90:
			return `translate(${state.sourceHeight} 0) rotate(90)`;
		case 180:
			return `translate(${state.sourceWidth} ${state.sourceHeight}) rotate(180)`;
		case 270:
			return `translate(0 ${state.sourceWidth}) rotate(270)`;
		default:
			return undefined;
	}
}
