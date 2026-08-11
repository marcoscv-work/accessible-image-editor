/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {renderToStaticMarkup} from 'react-dom/server';

import {EditState} from '../state/types';
import {FilterDefs, isIdentityFilter} from './FilterDefs';
import {rotationTransform} from './geometry';
import {LoadedImage} from './loadImage';
import {OverlayShape, overlayTransform} from './overlayShapes';

function blobToDataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = () => reject(new Error('Could not read the image'));
		reader.onload = () => resolve(reader.result as string);

		reader.readAsDataURL(blob);
	});
}

function loadIntoImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();

		image.onerror = () =>
			reject(new Error('Could not rasterize the edited image'));
		image.onload = () => resolve(image);

		image.src = src;
	});
}

/**
 * Exports the edit session. The same React components that draw the live
 * preview (FilterDefs, rotationTransform) render a standalone SVG string at
 * full resolution; the browser rasterizes it, and an offscreen canvas acts
 * purely as the final encoder. The bitmap must be inlined as a data URL:
 * SVG rasterized through <img> runs in secure static mode and cannot load
 * blob: subresources.
 */
export async function exportEditedImage(
	image: LoadedImage,
	state: EditState
): Promise<{blob: Blob; fileName: string}> {
	const dataUrl = await blobToDataURL(image.blob);

	const {crop} = state;

	const markup = renderToStaticMarkup(
		<svg
			height={crop.height}
			viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
			width={crop.width}
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<FilterDefs
					adjustments={state.adjustments}
					filter={state.filter}
					id="export-filter"
				/>
			</defs>

			<g transform={rotationTransform(state)}>
				<image
					filter={
						isIdentityFilter(state.adjustments, state.filter)
							? undefined
							: 'url(#export-filter)'
					}
					height={state.sourceHeight}
					href={dataUrl}
					width={state.sourceWidth}
				/>
			</g>

			{state.overlays.map((overlay) => (
				<g key={overlay.id} transform={overlayTransform(overlay)}>
					<OverlayShape overlay={overlay} />
				</g>
			))}
		</svg>
	);

	const rendered = await loadIntoImage(
		`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
	);

	const canvas = document.createElement('canvas');

	canvas.width = crop.width;
	canvas.height = crop.height;

	const context = canvas.getContext('2d');

	if (!context) {
		throw new Error('Could not create a 2d context for the export');
	}

	context.drawImage(rendered, 0, 0);

	const type = image.type === 'image/png' ? 'image/png' : 'image/jpeg';

	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(result) =>
				result
					? resolve(result)
					: reject(new Error('Export encoding failed')),
			type,
			0.92
		)
	);

	const baseName = image.fileName.replace(/\.[^.]+$/, '');

	return {
		blob,
		fileName: `${baseName}-edited.${type === 'image/png' ? 'png' : 'jpg'}`,
	};
}

export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');

	anchor.download = fileName;
	anchor.href = url;

	anchor.click();

	window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
