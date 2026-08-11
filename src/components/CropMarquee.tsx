import React, {useRef, useState} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {CropRect} from '../state/types';
import {FocusRing} from './FocusRing';

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

	const [focused, setFocused] = useState<string | null>(null);

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

	const handleKeyDown = (edges: Edges) => (event: React.KeyboardEvent) => {
		const delta = arrowDelta(event.key);

		if (!delta) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const step = event.shiftKey ? 10 : 1;

		keyboardGesture.current = true;

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

			dispatch({
				crop: adjustCrop(
					gesture.crop,
					edges,
					(event.clientX - gesture.startX) / zoom,
					(event.clientY - gesture.startY) / zoom
				),
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
				onFocus={() => setFocused('move')}
				onKeyDown={handleKeyDown(MOVE_EDGES)}
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

			{focused === 'move' && <FocusRing bounds={crop} zoom={zoom} />}

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

						{focused === direction && (
							<FocusRing
								bounds={{
									height: hitRadius * 2,
									width: hitRadius * 2,
									x: position.x - hitRadius,
									y: position.y - hitRadius,
								}}
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
							onFocus={() => setFocused(direction)}
							onKeyDown={handleKeyDown(edges)}
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
