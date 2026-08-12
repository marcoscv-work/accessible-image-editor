/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {EditState, rotatedSize} from '../state/types';

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

/**
 * Factor the image must grow by so that, rotated by `angle`, it still
 * covers a frame of the given size. Exported for unit testing.
 */
export function coverScale(
	width: number,
	height: number,
	angle: number
): number {
	if (!angle) {
		return 1;
	}

	const radians = (angle * Math.PI) / 180;

	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));

	return Math.max(
		(width * cos + height * sin) / width,
		(width * sin + height * cos) / height
	);
}

/**
 * The full transform placing the source image inside the stage: the
 * quarter turns, then the straighten angle with its cover scale, both
 * around the center of the frame. Shared by the preview, the export, and
 * the redaction sources so every projection stays aligned.
 */
export function imageTransform(
	state: Pick<
		EditState,
		'angle' | 'rotation' | 'sourceHeight' | 'sourceWidth'
	>
): string | undefined {
	const quarter = rotationTransform(state);

	if (!state.angle) {
		return quarter;
	}

	const bounds = rotatedSize(state as EditState);

	const centerX = bounds.width / 2;
	const centerY = bounds.height / 2;

	const scale = coverScale(bounds.width, bounds.height, state.angle);

	const straighten =
		`rotate(${state.angle} ${centerX} ${centerY}) ` +
		`translate(${centerX} ${centerY}) scale(${scale}) ` +
		`translate(${-centerX} ${-centerY})`;

	return quarter ? `${straighten} ${quarter}` : straighten;
}
