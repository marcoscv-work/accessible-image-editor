import {t} from '../i18n';
import {Overlay} from '../state/types';

export function starPath(cx: number, cy: number, size: number): string {
	const outer = size / 2;
	const inner = outer * 0.4;

	let d = '';

	for (let i = 0; i < 10; i++) {
		const radius = i % 2 === 0 ? outer : inner;
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;

		const x = cx + radius * Math.cos(angle);
		const y = cy + radius * Math.sin(angle);

		d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
	}

	return `${d}Z`;
}

/**
 * Approximate bounding box of an overlay, used for the keyboard/pointer
 * hit target. Text metrics are estimated (0.6em average advance), which is
 * good enough for a grab area.
 */
export function overlayBounds(overlay: Overlay): {
	height: number;
	width: number;
	x: number;
	y: number;
} {
	switch (overlay.kind) {
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
				width: Math.max(
					overlay.text.length * overlay.fontSize * 0.6,
					overlay.fontSize
				),
				x: overlay.x,
				y: overlay.y - overlay.fontSize,
			};
	}
}

export function overlayLabel(overlay: Overlay): string {
	switch (overlay.kind) {
		case 'shape':
			return t('overlay-shape-label');

		case 'sticker':
			return t('overlay-sticker-label');

		case 'text':
			return t('overlay-text-label', overlay.text);
	}
}

/**
 * The visual node of an overlay. Shared verbatim between the interactive
 * preview and the static export renderer.
 */
export function OverlayShape({overlay}: {overlay: Overlay}) {
	switch (overlay.kind) {
		case 'shape':
			return (
				<rect
					fill={overlay.color}
					height={overlay.height}
					width={overlay.width}
					x={overlay.x}
					y={overlay.y}
				/>
			);

		case 'sticker':
			return (
				<path
					d={starPath(overlay.x, overlay.y, overlay.size)}
					fill="#ffb800"
					stroke="#7d5a00"
					strokeWidth={overlay.size * 0.02}
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
	}
}
