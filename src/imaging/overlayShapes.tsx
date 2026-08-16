/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {t} from '../i18n';
import {Overlay, RedactLevel, StickerOverlay} from '../state/types';
import {StickerArt} from './stickerArt';

export {
	STICKER_DEFAULT_COLORS,
	STICKER_KINDS,
	StickerArt,
	starPath,
} from './stickerArt';

export const DEFAULT_BORDER_COLOR = '#272833';

let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * Real text width measured through an offscreen canvas, the same font
 * engine the SVG renderer uses. Falls back to a 0.6em average where
 * canvas is unavailable, which is jsdom.
 */
export function textWidth(
	content: string,
	fontFamily: string,
	fontSize: number
): number {
	if (measureContext === undefined) {
		try {
			measureContext = document
				.createElement('canvas')
				.getContext('2d');
		}
		catch {
			measureContext = null;
		}
	}

	if (measureContext) {
		measureContext.font = `${fontSize}px ${fontFamily}`;

		const width = measureContext.measureText(content).width;

		if (Number.isFinite(width) && width > 0) {
			return width;
		}
	}

	return Math.max(content.length * fontSize * 0.6, fontSize);
}

/**
 * Bounding box of an overlay, used for the selection frame, the
 * keyboard/pointer hit target, and the rotation pivot. Text width is
 * measured, not estimated.
 */
/**
 * The outline colour, or nothing at all when no border was asked for. A
 * width without a colour still draws, in the default border colour, so the
 * two fields do not have to be filled in a particular order.
 */
function borderStroke(overlay: {
	borderColor?: string;
	borderWidth?: number;
}): string | undefined {
	if (!overlay.borderWidth) {
		return undefined;
	}

	return overlay.borderColor ?? DEFAULT_BORDER_COLOR;
}

export function overlayBounds(overlay: Overlay): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	switch (overlay.kind) {
		case 'redact':
		case 'circle':
		case 'image':
		case 'shape':
			return {
				height: overlay.height,
				width: overlay.width,
				x: overlay.x,
				y: overlay.y,
			};

		case 'sticker':
			return {
				height: overlay.size,
				width: overlay.size,
				x: overlay.x - overlay.size / 2,
				y: overlay.y - overlay.size / 2,
			};

		case 'text':
			return {
				height: overlay.fontSize * 1.2,
				width: textWidth(
					overlay.text,
					overlay.fontFamily,
					overlay.fontSize
				),
				x: overlay.x,
				y: overlay.y - overlay.fontSize,
			};

		default:
			throw new Error('Unknown overlay kind');
	}
}

export function overlayCenter(overlay: Overlay): {x: number; y: number} {
	const bounds = overlayBounds(overlay);

	return {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
}

/**
 * The rotation transform of an overlay, around its center. Applied by the
 * stage to the whole interactive group and by the export renderer to the
 * static shape, so both stay identical.
 */
export function overlayTransform(overlay: Overlay): string | undefined {
	const rotation = overlay.rotation ?? 0;

	if (!rotation) {
		return undefined;
	}

	const center = overlayCenter(overlay);

	return `rotate(${rotation} ${center.x} ${center.y})`;
}

export function overlayLabel(overlay: Overlay): string {
	switch (overlay.kind) {
		case 'redact':
			return t('overlay-redact-label');

		case 'circle':
			return t('overlay-circle-label');

		case 'shape':
			return t('overlay-shape-label');

		case 'image':
			return overlay.description;

		case 'sticker':
			return t(`sticker-${overlay.sticker}`);

		case 'text':
			return t('overlay-text-label', overlay.text);

		default:
			throw new Error('Unknown overlay kind');
	}
}

/**
 * The visual node of an overlay. Shared verbatim between the interactive
 * preview and the static export renderer. Opacity (the native color input
 * offers no alpha channel) wraps the node as a group attribute, so it
 * rasterizes identically at export.
 */
export interface RedactSource {

	/**
	 * Reference to the color pipeline in use (`url(#...)`), so the mosaic
	 * carries the same adjustments and filter as the image underneath.
	 * Undefined when the pipeline is the identity.
	 */
	filter?: string;

	pixelUrls: Record<RedactLevel, string>;
	sourceHeight: number;
	sourceWidth: number;

	/**
	 * The same transform the base image uses, so the mosaic lines up with
	 * the photo whatever the rotation and straighten angle.
	 */
	transform?: string;
}

export function OverlayShape({
	overlay,
	redactSource,
}: {
	overlay: Overlay;
	redactSource?: RedactSource;
}) {
	const opacity = (overlay.opacity ?? 100) / 100;

	const node = renderOverlayNode(overlay, redactSource);

	return opacity < 1 ? <g opacity={opacity}>{node}</g> : node;
}

/**
 * A redaction reveals a heavily downsampled copy of the image through a
 * clip, scaled back up with nearest-neighbor: real pixelation, entirely
 * declarative. The inner counter-rotation keeps the mosaic locked to the
 * photo when the block itself is rotated.
 */
function RedactBlock({
	overlay,
	source,
}: {
	overlay: Extract<Overlay, {kind: 'redact'}>;
	source?: RedactSource;
}) {
	const clipId = `redact-clip-${overlay.id}`;

	if (!source) {
		return (
			<rect
				fill="#14151f"
				height={overlay.height}
				width={overlay.width}
				x={overlay.x}
				y={overlay.y}
			/>
		);
	}

	const centerX = overlay.x + overlay.width / 2;
	const centerY = overlay.y + overlay.height / 2;

	return (
		<>
			<defs>
				<clipPath id={clipId}>
					<rect
						height={overlay.height}
						width={overlay.width}
						x={overlay.x}
						y={overlay.y}
					/>
				</clipPath>
			</defs>

			<g clipPath={`url(#${clipId})`}>
				<g
					transform={`rotate(${-(
						overlay.rotation ?? 0
					)} ${centerX} ${centerY})`}
				>
					<g transform={source.transform}>
						<image
							filter={source.filter}
							height={source.sourceHeight}
							href={source.pixelUrls[overlay.level]}
							preserveAspectRatio="none"
							style={{imageRendering: 'pixelated'}}
							width={source.sourceWidth}
						/>
					</g>
				</g>
			</g>
		</>
	);
}

function renderOverlayNode(overlay: Overlay, redactSource?: RedactSource) {
	switch (overlay.kind) {
		case 'redact':
			return <RedactBlock overlay={overlay} source={redactSource} />;

		case 'circle':
			return (
				<ellipse
					cx={overlay.x + overlay.width / 2}
					cy={overlay.y + overlay.height / 2}
					fill={overlay.color}
					rx={overlay.width / 2}
					ry={overlay.height / 2}
					stroke={borderStroke(overlay)}
					strokeWidth={overlay.borderWidth || undefined}
				/>
			);

		case 'image':
			return (
				<image
					height={overlay.height}
					href={overlay.src}

					// The box is the geometry the user resized, so the
					// picture fills it rather than letterboxing inside it.

					preserveAspectRatio="none"
					width={overlay.width}
					x={overlay.x}
					y={overlay.y}
				/>
			);

		case 'shape':
			return (
				<rect
					fill={overlay.color}
					height={overlay.height}
					stroke={borderStroke(overlay)}
					strokeWidth={overlay.borderWidth || undefined}
					width={overlay.width}
					x={overlay.x}
					y={overlay.y}
				/>
			);

		case 'sticker':
			return (
				<StickerArt
					color={(overlay as StickerOverlay).color}
					size={overlay.size}
					sticker={overlay.sticker}
					x={overlay.x}
					y={overlay.y}
				/>
			);

		case 'text':
			return (
				<text
					fill={overlay.color}
					fontFamily={overlay.fontFamily}
					fontSize={overlay.fontSize}
					x={overlay.x}
					y={overlay.y}
				>
					{overlay.text}
				</text>
			);

		default:
			return null;
	}
}

/**
 * The same overlay, mirrored horizontally inside a frame of `boundsWidth`.
 * A flip has to carry the annotations with it: a redaction that stayed put
 * while the photograph mirrored underneath would uncover exactly what it
 * was hiding.
 */
export function mirrorOverlay(overlay: Overlay, boundsWidth: number): Overlay {
	const rotation = overlay.rotation ? -overlay.rotation : overlay.rotation;

	if (overlay.kind === 'sticker') {
		return {...overlay, rotation, x: boundsWidth - overlay.x};
	}

	if (overlay.kind === 'text') {
		const width = textWidth(
			overlay.text,
			overlay.fontFamily,
			overlay.fontSize
		);

		return {...overlay, rotation, x: boundsWidth - overlay.x - width};
	}

	return {
		...overlay,
		rotation,
		x: boundsWidth - overlay.x - overlay.width,
	};
}

/**
 * The box a pointer or a keyboard has to be able to hit, which is the
 * annotation's own box grown to `minimum` on each axis when the annotation
 * is smaller than that. A 6 pixel dot is a legitimate annotation; a 6 pixel
 * target is not (WCAG 2.2, 2.5.8), and the target is the only thing that
 * grows: what is painted stays the size it was asked for.
 */
export function overlayHitBox(
	overlay: Overlay,
	minimum: number
): {height: number; width: number; x: number; y: number} {
	const box = overlayBounds(overlay);

	const width = Math.max(box.width, minimum);
	const height = Math.max(box.height, minimum);

	return {
		height,
		width,
		x: box.x - (width - box.width) / 2,
		y: box.y - (height - box.height) / 2,
	};
}
