/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {pointsToPath, simplifyPoints} from '../imaging/strokeGeometry';
import {CropRect} from '../state/types';

/**
 * How far a pointer has to travel, in screen pixels, before a press is a
 * freehand gesture rather than the placing of one point.
 */
const DRAG_THRESHOLD = 4;

/**
 * Freehand points closer than this, in screen pixels, are not recorded:
 * the shape is what matters, not the event rate.
 */
const CAPTURE_SPACING = 3;

export interface DrawResult {
	points: number[];
	smooth: boolean;
}

interface Props {

	/**
	 * The crop rectangle, which is where the keyboard cursor starts and
	 * what the surface covers.
	 */
	area: CropRect;

	color: string;
	onAnnounce: (message: string) => void;

	/**
	 * Called once per finished stroke, or with null when drawing is
	 * cancelled. Points are absolute image coordinates.
	 */
	onFinish: (result: DrawResult | null) => void;

	width: number;
	zoom: number;
}

/**
 * The drawing mode. One surface, two routes to the same stroke: a drag is
 * freehand and commits on release, while clicks (or the keyboard cursor
 * with Enter) place pen points one at a time, no dragging required
 * anywhere (WCAG 2.5.7). Enter on the spot where the last point already
 * is finishes the stroke, the keyboard analogue of the pen's double
 * click; Backspace removes the last point; Escape abandons the stroke.
 */
export function DrawSurface({
	area,
	color,
	onAnnounce,
	onFinish,
	width,
	zoom,
}: Props) {
	const [points, setPoints] = useState<number[]>([]);

	const [cursor, setCursor] = useState({
		x: Math.round(area.x + area.width / 2),
		y: Math.round(area.y + area.height / 2),
	});

	const surfaceRef = useRef<SVGRectElement>(null);

	const gesture = useRef<{capturing: boolean; last: [number, number]} | null>(
		null
	);

	// The mode begins on the surface, where every key already works.

	useEffect(() => {
		surfaceRef.current?.focus({preventScroll: true});

		onAnnounce(t('draw-started'));

		// The announcement belongs to the mode's opening, not to any
		// later change of the announcer's identity.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const toImage = (event: React.PointerEvent): [number, number] => {
		const box = surfaceRef.current!.getBoundingClientRect();

		return [
			area.x + (event.clientX - box.left) / zoom,
			area.y + (event.clientY - box.top) / zoom,
		];
	};

	const addPoint = (x: number, y: number) => {
		setPoints((current) => [
			...current,
			Math.round(x * 10) / 10,
			Math.round(y * 10) / 10,
		]);
	};

	const finish = (raw: number[], smooth: boolean) => {
		if (raw.length < 4) {
			onFinish(null);

			onAnnounce(t('draw-cancelled'));

			return;
		}

		onFinish({points: raw, smooth});
	};

	const handlePointerDown = (event: React.PointerEvent<SVGRectElement>) => {
		event.currentTarget.setPointerCapture?.(event.pointerId);

		const [x, y] = toImage(event);

		gesture.current = {capturing: false, last: [x, y]};
	};

	const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
		const active = gesture.current;

		if (!active) {
			return;
		}

		const [x, y] = toImage(event);

		const spacing = CAPTURE_SPACING / zoom;

		if (!active.capturing) {

			// Not freehand until the hand actually moves: a click with a
			// shaky press must stay a click.

			if (
				Math.hypot(x - active.last[0], y - active.last[1]) * zoom <
				DRAG_THRESHOLD
			) {
				return;
			}

			active.capturing = true;

			setPoints((current) => [
				...current,
				active.last[0],
				active.last[1],
			]);
		}

		if (Math.hypot(x - active.last[0], y - active.last[1]) >= spacing) {
			active.last = [x, y];

			addPoint(x, y);
		}
	};

	const handlePointerUp = (event: React.PointerEvent<SVGRectElement>) => {
		const active = gesture.current;

		if (!active) {
			return;
		}

		gesture.current = null;

		const [x, y] = toImage(event);

		if (active.capturing) {

			// A freehand gesture is one stroke: simplified once, at a
			// tolerance measured on screen, and committed on release.

			finish(
				simplifyPoints([...points, x, y], 1.5 / zoom),
				true
			);

			return;
		}

		// A click places a pen point, and a second click on the same spot
		// finishes, mirroring the double-click convention.

		const last = points.length
			? [points[points.length - 2], points[points.length - 1]]
			: null;

		if (last && Math.hypot(x - last[0], y - last[1]) * zoom < 6) {
			finish(points, true);

			return;
		}

		addPoint(x, y);

		setCursor({x: Math.round(x), y: Math.round(y)});

		onAnnounce(
			t('draw-point-added', points.length / 2 + 1, Math.round(x), Math.round(y))
		);
	};

	const handleKeyDown = (event: React.KeyboardEvent<SVGRectElement>) => {
		const step = (event.shiftKey ? 10 : 1) / zoom;

		switch (event.key) {
			case 'ArrowDown':
				setCursor((at) => ({...at, y: at.y + step}));
				break;

			case 'ArrowLeft':
				setCursor((at) => ({...at, x: at.x - step}));
				break;

			case 'ArrowRight':
				setCursor((at) => ({...at, x: at.x + step}));
				break;

			case 'ArrowUp':
				setCursor((at) => ({...at, y: at.y - step}));
				break;

			case 'Enter': {
				const last = points.length
					? [points[points.length - 2], points[points.length - 1]]
					: null;

				// Enter where the last point already sits finishes: the
				// keyboard's double click.

				if (
					last &&
					Math.hypot(cursor.x - last[0], cursor.y - last[1]) <
						2 / zoom
				) {
					finish(points, true);

					break;
				}

				addPoint(cursor.x, cursor.y);

				onAnnounce(
					t(
						'draw-point-added',
						points.length / 2 + 1,
						Math.round(cursor.x),
						Math.round(cursor.y)
					)
				);
				break;
			}

			case 'Backspace':
			case 'Delete':
				setPoints((current) => current.slice(0, -2));

				onAnnounce(t('draw-point-removed'));
				break;

			case 'Escape':
				onFinish(null);

				onAnnounce(t('draw-cancelled'));
				break;

			default:
				return;
		}

		event.preventDefault();
		event.stopPropagation();
	};

	const preview = pointsToPath(points, true);

	return (
		<g className="editor-draw-surface">
			<desc id="draw-instructions">{t('draw-instructions')}</desc>

			<rect
				aria-describedby="draw-instructions"
				aria-label={t('draw-surface')}
				fill="transparent"
				height={area.height}
				onKeyDown={handleKeyDown}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				ref={surfaceRef}
				role="application"
				style={{cursor: 'crosshair'}}
				tabIndex={0}
				width={area.width}
				x={area.x}
				y={area.y}
			/>

			{Boolean(preview) && (
				<path
					className="editor-draw-preview"
					d={preview}
					fill="none"
					pointerEvents="none"
					stroke={color}
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={width}
				/>
			)}

			{/*
			  * The keyboard cursor: a crosshair that never grows or
			  * shrinks with the zoom, drawn last so it rides above the
			  * preview.
			  */}
			<g
				className="editor-draw-cursor"
				pointerEvents="none"
				transform={`translate(${cursor.x} ${cursor.y})`}
			>
				<line
					strokeWidth={1.5 / zoom}
					x1={-12 / zoom}
					x2={12 / zoom}
					y1={0}
					y2={0}
				/>
				<line
					strokeWidth={1.5 / zoom}
					x1={0}
					x2={0}
					y1={-12 / zoom}
					y2={12 / zoom}
				/>
			</g>
		</g>
	);
}
