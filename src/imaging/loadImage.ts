/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {RedactLevel} from '../state/types';

export const PREVIEW_MAX_SIZE = 2048;

/**
 * Longest side, in pixels, of the downsampled copy behind each redaction
 * level. Scaling these back up with nearest-neighbor is what produces the
 * mosaic, so a smaller source means coarser blocks.
 */
export const REDACT_SIZES: Record<RedactLevel, number> = {
	coarse: 24,
	fine: 96,
	medium: 48,
	tiny: 192,
};

export interface LoadedImage {

	/**
	 * The original, full-resolution file. Only read again at export time.
	 */
	blob: Blob;

	fileName: string;
	height: number;

	/**
	 * Object URL of the downscaled preview bitmap the SVG workspace
	 * displays. Never larger than PREVIEW_MAX_SIZE on its longest side.
	 */
	previewUrl: string;

	/**
	 * Data URLs of the downsampled sources used by redaction blocks, one
	 * per level. Data (not blob) URLs so the export SVG, which runs in
	 * secure static mode, can load them too.
	 */
	pixelUrls: Record<RedactLevel, string>;

	/**
	 * Tiny copy used by the filter gallery: running a colour pipeline per
	 * preset over the full preview bitmap would mean dozens of filtered
	 * draws of a multi-megapixel image just to paint 64x40 cards.
	 */
	thumbUrl: string;

	type: string;
	width: number;
}

function downsampleToDataURL(
	bitmap: ImageBitmap,
	longestSide: number,
	type = 'image/png'
): string {
	const scale = longestSide / Math.max(bitmap.width, bitmap.height);

	const canvas = document.createElement('canvas');

	canvas.width = Math.max(Math.round(bitmap.width * scale), 1);
	canvas.height = Math.max(Math.round(bitmap.height * scale), 1);

	const context = canvas.getContext('2d');

	if (!context) {
		return '';
	}

	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

	return canvas.toDataURL(type, 0.8);
}

/**
 * Longest side of a picture brought in as an annotation. Big enough to
 * stay crisp when it is exported into a large frame, small enough that
 * the data URL it becomes does not dominate the edit state.
 */
export const OVERLAY_IMAGE_MAX_SIZE = 1600;

/**
 * Reads a picture the user picked for an image annotation. PNG out, so
 * transparency survives, and a data URL rather than an object URL because
 * the export SVG cannot fetch `blob:`.
 */
export async function loadOverlayImage(
	blob: Blob
): Promise<{height: number; src: string; width: number}> {
	const bitmap = await createImageBitmap(blob);

	const longestSide = Math.max(bitmap.width, bitmap.height);

	const scale = Math.min(1, OVERLAY_IMAGE_MAX_SIZE / longestSide);

	const src = downsampleToDataURL(
		bitmap,
		Math.round(longestSide * scale),
		'image/png'
	);

	const {height, width} = bitmap;

	bitmap.close();

	if (!src) {
		throw new Error('Could not read the picture');
	}

	return {height, src, width};
}

/**
 * Decodes an image and prepares a downscaled preview. The offscreen canvas
 * here is a decoder/scaler only: it is never attached to the DOM and plays
 * no part in the interactive UI.
 */
export async function loadImage(
	blob: Blob,
	fileName: string
): Promise<LoadedImage> {
	const bitmap = await createImageBitmap(blob);

	const {height, width} = bitmap;

	let previewUrl: string;

	const longestSide = Math.max(width, height);

	if (longestSide > PREVIEW_MAX_SIZE) {
		const scale = PREVIEW_MAX_SIZE / longestSide;

		const canvas = document.createElement('canvas');

		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);

		const context = canvas.getContext('2d');

		if (!context) {
			throw new Error('Could not create a 2d context for the preview');
		}

		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

		const previewBlob = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(result) =>
					result
						? resolve(result)
						: reject(new Error('Preview encoding failed')),
				'image/jpeg',
				0.9
			)
		);

		previewUrl = URL.createObjectURL(previewBlob);
	}
	else {
		previewUrl = URL.createObjectURL(blob);
	}

	const thumbUrl = downsampleToDataURL(bitmap, 160, 'image/jpeg');

	const pixelUrls = {
		coarse: downsampleToDataURL(bitmap, REDACT_SIZES.coarse),
		fine: downsampleToDataURL(bitmap, REDACT_SIZES.fine),
		medium: downsampleToDataURL(bitmap, REDACT_SIZES.medium),
		tiny: downsampleToDataURL(bitmap, REDACT_SIZES.tiny),
	};

	bitmap.close();

	return {
		blob,
		fileName,
		height,
		pixelUrls,
		previewUrl,
		thumbUrl,
		type: blob.type || 'image/jpeg',
		width,
	};
}
