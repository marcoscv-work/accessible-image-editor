export const PREVIEW_MAX_SIZE = 2048;

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

	type: string;
	width: number;
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

	bitmap.close();

	return {
		blob,
		fileName,
		height,
		previewUrl,
		type: blob.type || 'image/jpeg',
		width,
	};
}
