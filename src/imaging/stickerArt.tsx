/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {StickerKind} from '../state/types';

/**
 * The sticker artwork: ten drawings, each described in a 24-unit box and
 * scaled by the stage, the export and the picker alike, so a sticker is
 * the same drawing everywhere it appears. Every shape here is ours.
 */

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
	'bolt',
	'check',
	'arrow',
	'smiley',
	'laugh',
	'love',
	'sad',
	'cool',
];

export const STICKER_DEFAULT_COLORS: Record<StickerKind, string> = {
	arrow: '#0b5fff',
	bolt: '#ffb800',
	check: '#287d3c',
	cool: '#ffb800',
	heart: '#da1414',
	laugh: '#ffb800',
	love: '#ffb800',
	sad: '#ffb800',
	smiley: '#ffb800',
	star: '#ffb800',
};

/**
 * Mixes a hex color toward black (negative amount) or white (positive),
 * used to derive sticker outlines and shading from the layer color.
 */
function shade(hex: string, amount: number): string {
	const value = hex.replace('#', '');

	if (value.length !== 6) {
		return hex;
	}

	const target = amount < 0 ? 0 : 255;
	const factor = Math.min(Math.abs(amount), 1);

	const mixed = [0, 2, 4].map((index) => {
		const channel = Number.parseInt(value.slice(index, index + 2), 16);

		return Math.round(channel + (target - channel) * factor);
	});

	return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const HEART_PATH =
	'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

const FACE_FEATURES = '#42381f';

/**
 * Shared face base: colored disc with a derived outline and a soft gloss.
 */
function FaceBase({color}: {color: string}) {
	return (
		<>
			<circle
				cx={12}
				cy={12}
				fill={color}
				r={10}
				stroke={shade(color, -0.35)}
				strokeWidth={1}
			/>

			<ellipse
				cx={9.5}
				cy={7}
				fill="#fff"
				opacity={0.3}
				rx={5}
				ry={2.6}
			/>
		</>
	);
}

function Blush() {
	return (
		<>
			<circle cx={6.4} cy={13.6} fill="#ff7b70" opacity={0.5} r={1.4} />
			<circle cx={17.6} cy={13.6} fill="#ff7b70" opacity={0.5} r={1.4} />
		</>
	);
}

/**
 * Circular badge with a white glyph, used by the check and arrow
 * stickers.
 */
function Badge({color, glyph}: {color: string; glyph: string}) {
	return (
		<>
			<circle
				cx={12}
				cy={12}
				fill={color}
				r={10}
				stroke={shade(color, -0.35)}
				strokeWidth={1}
			/>

			<ellipse
				cx={9.5}
				cy={7}
				fill="#fff"
				opacity={0.25}
				rx={5}
				ry={2.6}
			/>

			<path
				d={glyph}
				fill="#fff"
				transform="translate(3.6 3.6) scale(0.7)"
			/>
		</>
	);
}

function StickerBody({color, sticker}: {color: string; sticker: StickerKind}) {
	const outline = shade(color, -0.35);

	switch (sticker) {
		case 'arrow':
			return (
				<Badge
					color={color}
					glyph="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
				/>
			);

		case 'bolt':
			return (
				<>
					<path
						d="M7 2v11h3v9l7-12h-4l4-8z"
						fill={color}
						stroke={outline}
						strokeLinejoin="round"
						strokeWidth={1}
					/>

					<path
						d="M8.2 3.2v6.5"
						fill="none"
						opacity={0.5}
						stroke="#fff"
						strokeLinecap="round"
						strokeWidth={1}
					/>
				</>
			);

		case 'check':
			return (
				<Badge
					color={color}
					glyph="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
				/>
			);

		case 'cool':
			return (
				<>
					<FaceBase color={color} />

					<rect
						fill="#1f1f1f"
						height={3.8}
						rx={1.4}
						width={5.6}
						x={5.2}
						y={7.8}
					/>

					<rect
						fill="#1f1f1f"
						height={3.8}
						rx={1.4}
						width={5.6}
						x={13.2}
						y={7.8}
					/>

					<path
						d="M10.8 9.2h2.4M5.2 9l-2-.8M18.8 9l2-.8"
						fill="none"
						stroke="#1f1f1f"
						strokeLinecap="round"
						strokeWidth={1.2}
					/>

					<path
						d="M8.5 15.5q3.5 3 7 0"
						fill="none"
						stroke={FACE_FEATURES}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>
				</>
			);

		case 'heart':
			return (
				<>
					<path
						d={HEART_PATH}
						fill={color}
						stroke={outline}
						strokeLinejoin="round"
						strokeWidth={1}
					/>

					<ellipse
						cx={8}
						cy={7.6}
						fill="#fff"
						opacity={0.4}
						rx={2.4}
						ry={1.5}
						transform="rotate(-25 8 7.6)"
					/>
				</>
			);

		case 'laugh':
			return (
				<>
					<FaceBase color={color} />

					<path
						d="M6.6 9.6q1.9-2.2 3.8 0M13.6 9.6q1.9-2.2 3.8 0"
						fill="none"
						stroke={FACE_FEATURES}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>

					<path
						d="M7.5 13h9c0 3.1-2 5.4-4.5 5.4S7.5 16.1 7.5 13z"
						fill="#6b2f2f"
					/>

					<ellipse
						cx={12}
						cy={16.9}
						fill="#ff8a80"
						rx={2.6}
						ry={1.5}
					/>

					<Blush />
				</>
			);

		case 'love':
			return (
				<>
					<FaceBase color={color} />

					<path
						d={HEART_PATH}
						fill="#da1414"
						transform="translate(5.2 6.2) scale(0.28)"
					/>

					<path
						d={HEART_PATH}
						fill="#da1414"
						transform="translate(12.1 6.2) scale(0.28)"
					/>

					<path
						d="M8.5 15.8q3.5 3 7 0"
						fill="none"
						stroke={FACE_FEATURES}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>
				</>
			);

		case 'sad':
			return (
				<>
					<FaceBase color={color} />

					<circle cx={8.5} cy={10} fill={FACE_FEATURES} r={1.4} />
					<circle cx={15.5} cy={10} fill={FACE_FEATURES} r={1.4} />

					<path
						d="M8 17q4-3.2 8 0"
						fill="none"
						stroke={FACE_FEATURES}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>

					<path
						d="M16.9 11.8c1 1.4 1.5 2.3 1.5 3.1a1.5 1.5 0 11-3 0c0-.8.5-1.7 1.5-3.1z"
						fill="#4b9bff"
					/>
				</>
			);

		case 'smiley':
			return (
				<>
					<FaceBase color={color} />

					<circle cx={8.5} cy={10} fill={FACE_FEATURES} r={1.4} />
					<circle cx={15.5} cy={10} fill={FACE_FEATURES} r={1.4} />

					<path
						d="M7.5 13.5q4.5 4.5 9 0"
						fill="none"
						stroke={FACE_FEATURES}
						strokeLinecap="round"
						strokeWidth={1.6}
					/>

					<Blush />
				</>
			);

		case 'star':
			return (
				<>
					<path
						d={starPath(12, 12, 21)}
						fill={color}
						stroke={outline}
						strokeLinejoin="round"
						strokeWidth={1}
					/>

					<circle
						cx={9.6}
						cy={8.2}
						fill="#fff"
						opacity={0.5}
						r={1.2}
					/>
				</>
			);

		default:
			return null;
	}
}

interface StickerArtProps {
	color: string;
	size: number;
	sticker: StickerKind;
	x: number;
	y: number;
}

/**
 * The visual of a sticker, shared by the stage, the export, and the
 * picker previews. Every sticker is drawn in a 24-unit box and scaled
 * parametrically; outlines and shading derive from the layer color.
 */
export function StickerArt({color, size, sticker, x, y}: StickerArtProps) {
	return (
		<g
			transform={`translate(${x - size / 2} ${y - size / 2}) scale(${
				size / 24
			})`}
		>
			<StickerBody color={color} sticker={sticker} />
		</g>
	);
}
