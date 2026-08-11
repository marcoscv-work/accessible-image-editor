/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useRef, useState} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {CropRect} from '../state/types';
import {FocusModality, FocusRing, matchesFocusVisible} from './FocusRing';

type HandleDirection = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w';

interface Edges {
	bottom?: boolean;
	left?: boolean;
	right?: boolean;
	top?: boolean;
}

const HANDLES: Array<{direction: HandleDirection; edges: Edges}> = [
	{direction: 'nw', edges: {left: true, top: true}},
	{direction: 'n', edges: {top: true}},
	{direction: 'ne', edges: {right: true, top: true}},
	{direction: 'e', edges: {right: true}},
	{direction: 'se', edges: {bottom: true, right: true}},
	{direction: 's', edges: {bottom: true}},
	{direction: 'sw', edges: {bottom: true, left: true}},
	{direction: 'w', edges: {left: true}},
];

const MOVE_EDGES: Edges = {};

function handlePosition(
	crop: CropRect,
	direction: HandleDirection
): {x: number; y: number} {
	const x = direction.includes('w')
		? crop.x
		: direction.includes('e')
			? crop.x + crop.width
			: crop.x + crop.width / 2;

	const y = direction.includes('n')
		? crop.y
		: direction.includes('s')
			? crop.y + crop.height
			: crop.y + crop.height / 2;

	return {x, y};
}

/**
 * Moves the edges a handle owns; the empty edge set moves the whole
 * rectangle. Clamping happens in the reducer.
 */
function adjustCrop(
	crop: CropRect,
	edges: Edges,
	dx: number,
	dy: number
): CropRect {
	let {height, width, x, y} = crop;

	if (!edges.bottom && !edges.left && !edges.right && !edges.top) {
		return {height, width, x: x + dx, y: y + dy};
	}

	if (edges.left) {
		x += dx;
		width -= dx;
	}

	if (edges.right) {
		width += dx;
	}

	if (edges.top) {
		y += dy;
		height -= dy;
	}

	if (edges.bottom) {
		height += dy;
	}

	return {height, width, x, y};
}

function arrowDelta(key: string): [number, number] | null {
	switch (key) {
		case 'ArrowDown':
			return [0, 1];
		case 'ArrowLeft':
			return [-1, 0];
		case 'ArrowRight':
			return [1, 0];
		case 'ArrowUp':
			return [0, -1];
		default:
			return null;
	}
}

/**
 * Drawing-tool drag modifiers: Shift keeps the proportions of the crop
 * the gesture started from, Alt resizes around its center. Without
 * modifiers the base rectangle passes through untouched. Exported for
 * unit testing.
 */
export function applyResizeModifiers(
	base: CropRect,
	origin: CropRect,
	edges: Edges,
	options: {center: boolean; proportional: boolean}
): CropRect {
	const isResize = !!(edges.bottom || edges.left || edges.right || edges.top);

	if (!isResize || (!options.center && !options.proportional)) {
		return base;
	}

	let {height, width} = base;

	if (options.center) {
		width = origin.width + 2 * (base.width - origin.width);
		height = origin.height + 2 * (base.height - origin.height);
	}

	if (options.proportional) {
		const scaleX = width / origin.width;
		const scaleY = height / origin.height;

		const horizontal = !!(edges.left || edges.right);
		const vertical = !!(edges.bottom || edges.top);

		const scale =
			horizontal && vertical
				? Math.max(Math.abs(scaleX), Math.abs(scaleY))
				: horizontal
					? Math.abs(scaleX)
					: Math.abs(scaleY);

		width = origin.width * scale;
		height = origin.height * scale;
	}

	let x;
	let y;

	if (options.center) {
		x = origin.x + origin.width / 2 - width / 2;
		y = origin.y + origin.height / 2 - height / 2;
	}
	else {
		x = edges.left
			? origin.x + origin.width - width
			: edges.right
				? origin.x
				: origin.x + origin.width / 2 - width / 2;
		y = edges.top
			? origin.y + origin.height - height
			: edges.bottom
				? origin.y
				: origin.y + origin.height / 2 - height / 2;
	}

	return {height, width, x, y};
}

interface Props {

	/**
	 * Rendered between the crop-move surface and the handles: annotations
	 * must sit above the whole-area move rect (or it swallows their
	 * pointer events) but below the handles.
	 */
	children?: React.ReactNode;

	crop: CropRect;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;

	/**
	 * CSS pixels per SVG user unit, used to keep handle hit targets at
	 * least 24x24 CSS pixels regardless of zoom.
	 */
	zoom: number;
}

export function CropMarquee({
	children,
	crop,
	dispatch,
	onAnnounce,
	zoom,
}: Props) {
	const cropRef = useRef(crop);

	cropRef.current = crop;

	const [focused, setFocused] = useState<{
		key: string;
		modality: FocusModality;
	} | null>(null);

	const keyboardGesture = useRef(false);

	const pointerGesture = useRef<{
		crop: CropRect;
		startX: number;
		startY: number;
	} | null>(null);

	const announceCrop = () => {
		const current = cropRef.current;

		onAnnounce(
			t(
				'crop-applied',
				current.x,
				current.y,
				current.width,
				current.height
			)
		);
	};

	const handleKeyDown =
		(edges: Edges, focusKey: string) => (event: React.KeyboardEvent) => {
		const delta = arrowDelta(event.key);

		if (!delta) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const step = event.shiftKey ? 10 : 1;

		keyboardGesture.current = true;

		// Arrow keys are keyboard interaction even after a mouse focus:
		// surface the full ring.

		setFocused({key: focusKey, modality: 'keyboard'});

		dispatch({
			crop: adjustCrop(
				cropRef.current,
				edges,
				delta[0] * step,
				delta[1] * step
			),
			transient: true,
			type: 'set-crop',
		});
	};

	const handleKeyUp = (event: React.KeyboardEvent) => {
		if (!arrowDelta(event.key) || !keyboardGesture.current) {
			return;
		}

		keyboardGesture.current = false;

		dispatch({crop: cropRef.current, type: 'set-crop'});

		announceCrop();
	};

	const handlePointerDown = (event: React.PointerEvent<SVGElement>) => {
		event.currentTarget.setPointerCapture?.(event.pointerId);

		pointerGesture.current = {
			crop: cropRef.current,
			startX: event.clientX,
			startY: event.clientY,
		};
	};

	const handlePointerMove =
		(edges: Edges) => (event: React.PointerEvent<SVGElement>) => {
			const gesture = pointerGesture.current;

			if (!gesture) {
				return;
			}

			const base = adjustCrop(
				gesture.crop,
				edges,
				(event.clientX - gesture.startX) / zoom,
				(event.clientY - gesture.startY) / zoom
			);

			dispatch({
				crop: applyResizeModifiers(base, gesture.crop, edges, {
					center: event.altKey,
					proportional: event.shiftKey,
				}),
				transient: true,
				type: 'set-crop',
			});
		};

	const handlePointerUp = () => {
		if (!pointerGesture.current) {
			return;
		}

		pointerGesture.current = null;

		dispatch({crop: cropRef.current, type: 'set-crop'});

		announceCrop();
	};

	const hitRadius = 12 / zoom;
	const visualRadius = 6 / zoom;
	const strokeWidth = 2 / zoom;

	return (
		<g>
			<desc id="crop-area-description">{t('crop-area-description')}</desc>

			<desc id="crop-handle-description">
				{t('crop-handle-description')}
			</desc>

			<rect
				className="crop-border"
				fill="none"
				height={crop.height}
				pointerEvents="none"
				strokeWidth={strokeWidth}
				width={crop.width}
				x={crop.x}
				y={crop.y}
			/>

			<rect
				aria-describedby="crop-area-description"
				aria-label={t('crop-area')}
				className="crop-move"
				fill="transparent"
				height={crop.height}
				onBlur={() => setFocused(null)}
				onFocus={(event) =>
					setFocused({
						key: 'move',
						modality: matchesFocusVisible(event.currentTarget)
							? 'keyboard'
							: 'pointer',
					})
				}
				onKeyDown={handleKeyDown(MOVE_EDGES, 'move')}
				onKeyUp={handleKeyUp}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove(MOVE_EDGES)}
				onPointerUp={handlePointerUp}
				role="button"
				tabIndex={0}
				width={crop.width}
				x={crop.x}
				y={crop.y}
			/>

			{focused?.key === 'move' && (
				<FocusRing
					bounds={crop}
					emphasis={focused.modality}
					zoom={zoom}
				/>
			)}

			{children}

			{HANDLES.map(({direction, edges}) => {
				const position = handlePosition(crop, direction);

				return (
					<g key={direction}>
						<circle
							className="crop-handle-visual"
							cx={position.x}
							cy={position.y}
							pointerEvents="none"
							r={visualRadius}
							strokeWidth={strokeWidth}
						/>

						{focused?.key === direction && (
							<FocusRing
								bounds={{
									height: hitRadius * 2,
									width: hitRadius * 2,
									x: position.x - hitRadius,
									y: position.y - hitRadius,
								}}
								emphasis={focused.modality}
								shape="circle"
								zoom={zoom}
							/>
						)}

						<circle
							aria-describedby="crop-handle-description"
							aria-label={t(`crop-handle-${direction}`)}
							className="crop-handle"
							cx={position.x}
							cy={position.y}
							fill="transparent"
							onBlur={() => setFocused(null)}
							onFocus={(event) =>
								setFocused({
									key: direction,
									modality: matchesFocusVisible(
										event.currentTarget
									)
										? 'keyboard'
										: 'pointer',
								})
							}
							onKeyDown={handleKeyDown(edges, direction)}
							onKeyUp={handleKeyUp}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove(edges)}
							onPointerUp={handlePointerUp}
							r={hitRadius}
							role="button"
							tabIndex={0}
						/>
					</g>
				);
			})}
		</g>
	);
}
