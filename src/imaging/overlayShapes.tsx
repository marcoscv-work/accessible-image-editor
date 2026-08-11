import {t} from '../i18n';
import {Overlay, StickerKind, StickerOverlay} from '../state/types';

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

export const STICKER_KINDS: StickerKind[] = [
	'star',
	'heart',
	'check',
	'arrow',
	'bolt',
	'smiley',
];

export const STICKER_DEFAULT_COLORS: Record<StickerKind, string> = {
	arrow: '#0b5fff',
	bolt: '#ffb800',
	check: '#287d3c',
	heart: '#da1414',
	smiley: '#ffb800',
	star: '#ffb800',
};

/**
 * Single-color 24x24 icon paths (Material-style outlines), scaled and
 * centered parametrically. The star keeps its computed path.
 */
const STICKER_PATHS: Partial<Record<StickerKind, string>> = {
	arrow: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
	bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
	check: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
	heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
};

interface StickerArtProps {
	color: string;
	size: number;
	sticker: StickerKind;
	x: number;
	y: number;
}

/**
 * The visual of a sticker, shared by the stage, the export, and the
 * picker previews.
 */
export function StickerArt({color, size, sticker, x, y}: StickerArtProps) {
	if (sticker === 'star') {
		return <path d={starPath(x, y, size)} fill={color} />;
	}

	const transform = `translate(${x - size / 2} ${y - size / 2}) scale(${
		size / 24
	})`;

	if (sticker === 'smiley') {
		return (
			<g transform={transform}>
				<circle cx={12} cy={12} fill={color} r={10} />
				<circle cx={8.5} cy={9.5} fill="#42381f" r={1.5} />
				<circle cx={15.5} cy={9.5} fill="#42381f" r={1.5} />
				<path
					d="M7.5 14s1.75 2.5 4.5 2.5 4.5-2.5 4.5-2.5"
					fill="none"
					stroke="#42381f"
					strokeLinecap="round"
					strokeWidth={1.5}
				/>
			</g>
		);
	}

	return (
		<path d={STICKER_PATHS[sticker]} fill={color} transform={transform} />
	);
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
			return t(`sticker-${overlay.sticker}`);

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
	}
}
