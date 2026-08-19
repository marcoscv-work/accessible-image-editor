/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {EditState, Overlay, rotatedSize} from '../state/types';
import {coverScale} from './geometry';
import {overlayCenter, textWidth} from './overlayShapes';
import {pointsBounds} from './strokeGeometry';

/**
 * Affine matrices in SVG order: x' = a·x + c·y + e, y' = b·x + d·y + f.
 * The stage's transform and the overlay mapping are built from the same
 * composition, which is the whole point: what the picture does and what
 * the annotations do cannot drift apart, because they are one matrix.
 */
export type Matrix = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * first ∘ second: the result applies `second`, then `first`, matching how
 * an SVG transform list reads left to right.
 */
export function multiply(first: Matrix, second: Matrix): Matrix {
	const [a1, b1, c1, d1, tx1, ty1] = first;
	const [a2, b2, c2, d2, tx2, ty2] = second;

	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * tx2 + c1 * ty2 + tx1,
		b1 * tx2 + d1 * ty2 + ty1,
	];
}

export function invert(matrix: Matrix): Matrix {
	const [a, b, c, d, tx, ty] = matrix;

	const det = a * d - b * c;

	return [
		d / det,
		-b / det,
		-c / det,
		a / det,
		(c * ty - d * tx) / det,
		(b * tx - a * ty) / det,
	];
}

export function applyToPoint(
	matrix: Matrix,
	x: number,
	y: number
): [number, number] {
	const [a, b, c, d, tx, ty] = matrix;

	return [a * x + c * y + tx, b * x + d * y + ty];
}

/**
 * The linear part only: what a direction (an arrow's vector) goes
 * through, since translation does not apply to differences.
 */
export function applyToVector(
	matrix: Matrix,
	x: number,
	y: number
): [number, number] {
	const [a, b, c, d] = matrix;

	return [a * x + c * y, b * x + d * y];
}

function translation(tx: number, ty: number): Matrix {
	return [1, 0, 0, 1, tx, ty];
}

function rotationDeg(degrees: number): Matrix {
	const radians = (degrees * Math.PI) / 180;

	const cos = Math.cos(radians);
	const sin = Math.sin(radians);

	return [cos, sin, -sin, cos, 0, 0];
}

function about(inner: Matrix, cx: number, cy: number): Matrix {
	return multiply(
		translation(cx, cy),
		multiply(inner, translation(-cx, -cy))
	);
}

/**
 * The stage's own transform, as a matrix: mirror, then straighten, then
 * the quarter turns, in exactly the order `imageTransform` composes its
 * string. Maps source-image coordinates to display (overlay) space.
 */
export function imageMatrix(
	state: Pick<
		EditState,
		'angle' | 'flipHorizontal' | 'rotation' | 'sourceHeight' | 'sourceWidth'
	>
): Matrix {
	const bounds = rotatedSize(state as EditState);

	let matrix: Matrix = IDENTITY;

	// Quarter turns, innermost.

	switch (state.rotation) {
		case 90:
			matrix = multiply(
				translation(state.sourceHeight, 0),
				rotationDeg(90)
			);
			break;

		case 180:
			matrix = multiply(
				translation(state.sourceWidth, state.sourceHeight),
				rotationDeg(180)
			);
			break;

		case 270:
			matrix = multiply(
				translation(0, state.sourceWidth),
				rotationDeg(270)
			);
			break;

		default:
			break;
	}

	if (state.angle) {
		const centerX = bounds.width / 2;
		const centerY = bounds.height / 2;

		const scale = coverScale(bounds.width, bounds.height, state.angle);

		const straighten = multiply(
			about(rotationDeg(state.angle), centerX, centerY),
			about([scale, 0, 0, scale, 0, 0], centerX, centerY)
		);

		matrix = multiply(straighten, matrix);
	}

	if (state.flipHorizontal) {
		matrix = multiply(
			multiply(translation(bounds.width, 0), [-1, 0, 0, 1, 0, 0]),
			matrix
		);
	}

	return matrix;
}

/**
 * The similarity a matrix encodes: a uniform scale and a rotation. The
 * overlay mapping is always one of these, because every stage transform
 * is rotations, uniform scales, translations and paired reflections.
 */
export function similarityOf(matrix: Matrix): {
	degrees: number;
	reflected: boolean;
	scale: number;
} {
	const [a, b, c, d] = matrix;

	return {
		degrees: (Math.atan2(b, a) * 180) / Math.PI,
		reflected: a * d - b * c < 0,
		scale: Math.hypot(a, b),
	};
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Rotation folded into the box for the kinds whose content has no
 * orientation of its own: box(w, h, r + 90) draws exactly as
 * box(h, w, r), and the second one is what a person expects to read in
 * the fields after rotating the canvas.
 */
function foldBoxRotation(
	width: number,
	height: number,
	rotation: number
): {height: number; rotation: number; width: number} {
	let folded = ((rotation % 360) + 360) % 360;
	let w = width;
	let h = height;

	while (folded >= 90) {
		folded -= 90;

		[w, h] = [h, w];
	}

	return {height: h, rotation: round(folded), width: w};
}

/**
 * An overlay carried through a similarity transform: positions map,
 * sizes scale, own rotations turn with it. Exact for every kind, which
 * is what lets a redaction keep covering the very pixels it was hiding.
 */
export function transformOverlay(overlay: Overlay, matrix: Matrix): Overlay {
	const {degrees, reflected, scale} = similarityOf(matrix);

	if (reflected) {

		// Reflections have their own path (mirrorOverlay): a similarity
		// with a flip would silently mirror text and arrows.

		throw new Error('transformOverlay: reflected matrix');
	}

	switch (overlay.kind) {
		case 'circle':
		case 'redact':
		case 'shape': {
			const [cx, cy] = applyToPoint(
				matrix,
				overlay.x + overlay.width / 2,
				overlay.y + overlay.height / 2
			);

			const folded = foldBoxRotation(
				overlay.width * scale,
				overlay.height * scale,
				(overlay.rotation ?? 0) + degrees
			);

			return {
				...overlay,
				height: round(folded.height),
				rotation: folded.rotation || undefined,
				width: round(folded.width),
				x: round(cx - folded.width / 2),
				y: round(cy - folded.height / 2),
			};
		}

		case 'image': {

			// A picture's content has an orientation, so the turn lives
			// in `rotation` rather than being folded away.

			const [cx, cy] = applyToPoint(
				matrix,
				overlay.x + overlay.width / 2,
				overlay.y + overlay.height / 2
			);

			const width = round(overlay.width * scale);
			const height = round(overlay.height * scale);

			return {
				...overlay,
				height,
				rotation:
					round(
						(((overlay.rotation ?? 0) + degrees) % 360 + 360) %
							360
					) || undefined,
				width,
				x: round(cx - width / 2),
				y: round(cy - height / 2),
			};
		}

		case 'text': {
			const center = overlayCenter(overlay);

			const [cx, cy] = applyToPoint(matrix, center.x, center.y);

			const fontSize = round(overlay.fontSize * scale);

			const width = textWidth(
				overlay.text,
				overlay.fontFamily,
				fontSize
			);

			return {
				...overlay,
				fontSize,
				rotation:
					round(
						(((overlay.rotation ?? 0) + degrees) % 360 + 360) %
							360
					) || undefined,
				x: round(cx - width / 2),

				// The anchor is the baseline; the bounds put the center
				// 0.4 font sizes above it.

				y: round(cy + 0.4 * fontSize),
			};
		}

		case 'emoji': {
			const [cx, cy] = applyToPoint(matrix, overlay.x, overlay.y);

			return {
				...overlay,
				rotation:
					round(
						(((overlay.rotation ?? 0) + degrees) % 360 + 360) %
							360
					) || undefined,
				size: round(overlay.size * scale),
				x: round(cx),
				y: round(cy),
			};
		}

		case 'arrow': {
			const [x, y] = applyToPoint(matrix, overlay.x, overlay.y);
			const [dx, dy] = applyToVector(matrix, overlay.dx, overlay.dy);

			return {
				...overlay,
				dx: round(dx),
				dy: round(dy),
				thickness: round(overlay.thickness * scale),
				x: round(x),
				y: round(y),
			};
		}

		case 'stroke': {

			// The points are the geometry: map them and rebase the
			// origin on the new bounding box. The own rotation commutes
			// with the similarity, so it stays.

			const absolute: Array<[number, number]> = [];

			for (let index = 0; index < overlay.points.length; index += 2) {
				absolute.push(
					applyToPoint(
						matrix,
						overlay.x + overlay.points[index],
						overlay.y + overlay.points[index + 1]
					)
				);
			}

			const flat = absolute.flat();

			const box = pointsBounds(flat);

			return {
				...overlay,
				points: flat.map((value, index) =>
					round(value - (index % 2 === 0 ? box.x : box.y))
				),
				width: round(overlay.width * scale),
				x: round(box.x),
				y: round(box.y),
			};
		}

		default:
			return overlay;
	}
}
