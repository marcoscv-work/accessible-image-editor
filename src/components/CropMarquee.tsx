/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayIconSpriteContext} from '@clayui/icon';
import React, {useContext, useEffect, useRef, useState} from 'react';

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
	/**
	 * Size of the rotated image, so the marquee knows whether the crop
	 * is a real selection (and worth offering the recenter control).
	 */
	bounds: {height: number; width: number};

	children?: React.ReactNode;

	crop: CropRect;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	onCenterCrop: () => void;

	/**
	 * False once the view already frames the crop, so the control does
	 * not offer an action that would change nothing.
	 */
	showRecenter: boolean;

	/**
	 * The crop chrome (marquee, handles, recenter) is only rendered when
	 * the crop section is enabled; the children still are.
	 */
	showCrop: boolean;

	/**
	 * CSS pixels per SVG user unit, used to keep handle hit targets at
	 * least 24x24 CSS pixels regardless of zoom.
	 */
	zoom: number;
}

export function CropMarquee({
	bounds,
	children,
	crop,
	dispatch,
	onAnnounce,
	onCenterCrop,
	showCrop,
	showRecenter,
	zoom,
}: Props) {
	const cropRef = useRef(crop);

	cropRef.current = crop;

	const [focused, setFocused] = useState<{
		key: string;
		modality: FocusModality;
	} | null>(null);

	/**
	 * True while a resize or move gesture runs: the thirds grid shows
	 * only then, as a composition aid that never clutters the idle view.
	 */
	const [gesturing, setGesturing] = useState(false);

	const [recenterFocused, setRecenterFocused] = useState(false);

	const spritemap = useContext(ClayIconSpriteContext);

	const moveRef = useRef<SVGRectElement>(null);

	/**
	 * Whether the recenter control currently holds focus, regardless of
	 * modality: hiding a focused control would drop focus to the body, so
	 * it is handed to the crop area instead.
	 */
	const recenterHasFocus = useRef(false);

	useEffect(() => {
		if (!showRecenter && recenterHasFocus.current) {
			recenterHasFocus.current = false;

			moveRef.current?.focus();
		}
	}, [showRecenter]);

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

		setGesturing(true);

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

		setGesturing(false);

		dispatch({crop: cropRef.current, type: 'set-crop'});

		announceCrop();
	};

	const handlePointerDown = (event: React.PointerEvent<SVGElement>) => {
		event.currentTarget.setPointerCapture?.(event.pointerId);

		setGesturing(true);

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

		setGesturing(false);

		dispatch({crop: cropRef.current, type: 'set-crop'});

		announceCrop();
	};

	const gridWidth = 1 / zoom;
	const hitRadius = 12 / zoom;
	const visualRadius = 6 / zoom;
	const strokeWidth = 2 / zoom;

	// Paint order inside the marquee: the grid and the move surface, the
	// annotations, then the dim layer (so anything outside the crop looks
	// dimmed, annotations included, matching what the export will cut),
	// the border, the recenter control, and the resize handles on top.

	const dimPath =
		`M0 0H${bounds.width}V${bounds.height}H0Z` +
		`M${crop.x} ${crop.y}` +
		`H${crop.x + crop.width}V${crop.y + crop.height}H${crop.x}Z`;

	if (!showCrop) {
		return <g>{children}</g>;
	}

	return (
		<g>
			<desc id="crop-area-description">{t('crop-area-description')}</desc>

			<desc id="crop-handle-description">
				{t('crop-handle-description')}
			</desc>

			<g
					className={
						gesturing ? 'crop-grid crop-grid-visible' : 'crop-grid'
					}
					pointerEvents="none"
				>
					{[1, 2].map((step) => (
						<line
							key={`v-${step}`}
							strokeWidth={gridWidth}
							x1={crop.x + (crop.width * step) / 3}
							x2={crop.x + (crop.width * step) / 3}
							y1={crop.y}
							y2={crop.y + crop.height}
						/>
					))}

					{[1, 2].map((step) => (
						<line
							key={`h-${step}`}
							strokeWidth={gridWidth}
							x1={crop.x}
							x2={crop.x + crop.width}
							y1={crop.y + (crop.height * step) / 3}
							y2={crop.y + (crop.height * step) / 3}
						/>
					))}
				</g>

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
				ref={moveRef}
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

			<path
				className="crop-dim"
				d={dimPath}
				fillRule="evenodd"
				pointerEvents="none"
			/>

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


			{showRecenter &&
				(crop.width < bounds.width ||
					crop.height < bounds.height) && (
				<g
					className={
						recenterFocused
							? 'crop-recenter crop-recenter-focused'
							: 'crop-recenter'
					}
					onBlur={() => {
						recenterHasFocus.current = false;

						setRecenterFocused(false);
					}}
					onClick={onCenterCrop}
					onFocus={(event) => {
						recenterHasFocus.current = true;

						setRecenterFocused(
							matchesFocusVisible(event.currentTarget)
						);
					}}
					onKeyDown={(event: React.KeyboardEvent) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onCenterCrop();
						}
					}}
					role="button"
					tabIndex={0}
				>
					<title>{t('center-crop')}</title>

					<circle
						className="crop-recenter-disc"
						cx={crop.x + crop.width / 2}
						cy={crop.y + crop.height / 2}
						r={16 / zoom}
					/>

					<use
						className="crop-recenter-icon"
						height={18 / zoom}
						href={`${spritemap}#autosize`}
						width={18 / zoom}
						x={crop.x + crop.width / 2 - 9 / zoom}
						y={crop.y + crop.height / 2 - 9 / zoom}
					/>
					</g>
				)}


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
