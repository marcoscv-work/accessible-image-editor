/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useRef, useState} from 'react';

import {t} from '../i18n';
import {
	OverlayShape,
	overlayBounds,
	overlayLabel,
	overlayTransform,
	textWidth,
} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {Overlay} from '../state/types';
import {FocusModality, FocusRing, matchesFocusVisible} from './FocusRing';

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
 * Rotates a client-space delta into the overlay's local axes, for the
 * on-stage manipulation gestures that operate inside the rotated group.
 */
function toLocalDelta(
	dx: number,
	dy: number,
	rotation: number
): [number, number] {
	if (!rotation) {
		return [dx, dy];
	}

	const radians = (rotation * Math.PI) / 180;

	const cos = Math.cos(radians);
	const sin = Math.sin(radians);

	return [dx * cos + dy * sin, -dx * sin + dy * cos];
}

/**
 * Rotates a local-space vector into stage space (the inverse of
 * toLocalDelta), used to keep a stretched rectangle's opposite side
 * anchored in place under rotation.
 */
function toStageDelta(
	dx: number,
	dy: number,
	rotation: number
): [number, number] {
	if (!rotation) {
		return [dx, dy];
	}

	const radians = (rotation * Math.PI) / 180;

	const cos = Math.cos(radians);
	const sin = Math.sin(radians);

	return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/**
 * Background for the inline text editor, picked against the text color's
 * luminance so the value stays readable whatever color the user chose.
 */
function editorBackground(color: string): string {
	const value = color.replace('#', '');

	if (value.length === 6) {
		const [r, g, b] = [0, 2, 4].map((index) =>
			Number.parseInt(value.slice(index, index + 2), 16)
		);

		if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55) {
			return 'rgba(20, 21, 31, 0.92)';
		}
	}

	return 'rgba(255, 255, 255, 0.92)';
}

const STRETCH_EDGES = [
	{cursor: 'ns-resize', name: 'n', x: 0.5, y: 0},
	{cursor: 'ew-resize', name: 'e', x: 1, y: 0.5},
	{cursor: 'ns-resize', name: 's', x: 0.5, y: 1},
	{cursor: 'ew-resize', name: 'w', x: 0, y: 0.5},
] as const;

const RESIZE_CORNERS = [
	{cursor: 'nwse-resize', name: 'nw', x: 0, y: 0},
	{cursor: 'nesw-resize', name: 'ne', x: 1, y: 0},
	{cursor: 'nwse-resize', name: 'se', x: 1, y: 1},
	{cursor: 'nesw-resize', name: 'sw', x: 0, y: 1},
];

interface ManipGesture {
	centerX: number;
	centerY: number;
	edge?: 'e' | 'n' | 's' | 'w';
	id: string;
	kind: 'resize' | 'rotate';
	overlay: Overlay;
	startAngle: number;
	startDistance: number;
	startX: number;
	startY: number;
}

interface Props {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	onSelect: (id: string | null) => void;
	overlays: Overlay[];
	selectedId: string | null;
	zoom: number;
}

/**
 * The annotation layer of the preview: every overlay is a real, focusable
 * SVG node, movable with the arrow keys or a pointer drag, removable with
 * Delete. The visual shape itself is shared with the export renderer.
 */
export function OverlaysEditable({
	dispatch,
	onAnnounce,
	onSelect,
	overlays,
	selectedId,
	zoom,
}: Props) {
	const overlaysRef = useRef(overlays);

	overlaysRef.current = overlays;

	const [focus, setFocus] = useState<{
		id: string;
		modality: FocusModality;
	} | null>(null);

	const keyboardGesture = useRef<string | null>(null);

	const pointerGesture = useRef<{
		id: string;
		startX: number;
		startY: number;
		x: number;
		y: number;
	} | null>(null);

	const manipGesture = useRef<ManipGesture | null>(null);

	const [editing, setEditing] = useState<{
		draft: string;
		id: string;
	} | null>(null);

	const current = (id: string) =>
		overlaysRef.current.find((overlay) => overlay.id === id);

	const announceMoved = (id: string) => {
		const overlay = current(id);

		if (overlay) {
			onAnnounce(
				t(
					'annotation-moved',
					overlayLabel(overlay),
					Math.round(overlay.x),
					Math.round(overlay.y)
				)
			);
		}
	};

	const handleKeyDown =
		(id: string) => (event: React.KeyboardEvent<SVGElement>) => {
			if (event.key === 'Enter') {

				// Jump to the annotation's property editor, as announced
				// in the overlay instructions.

				event.preventDefault();

				onSelect(id);

				window.setTimeout(() => {
					document
						.querySelector<HTMLElement>(
							'.editor-layer-properties input, .editor-layer-properties select'
						)
						?.focus();
				}, 0);

				return;
			}

			if (event.key === 'Delete' || event.key === 'Backspace') {
				const overlay = current(id);

				event.preventDefault();

				dispatch({id, type: 'remove-overlay'});

				if (overlay) {
					onAnnounce(
						t('annotation-removed', overlayLabel(overlay))
					);
				}

				return;
			}

			const delta = arrowDelta(event.key);

			if (!delta) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const overlay = current(id);

			if (!overlay) {
				return;
			}

			const step = event.shiftKey ? 10 : 1;

			keyboardGesture.current = id;

			// Arrow keys are keyboard interaction even after a mouse
			// focus: surface the full ring.

			setFocus({id, modality: 'keyboard'});

			// The rotation pivot is the overlay's own center, so it travels
			// with the element: a plain positional delta already moves the
			// element exactly along the screen axes, rotated or not.

			dispatch({
				id,
				patch: {
					x: overlay.x + delta[0] * step,
					y: overlay.y + delta[1] * step,
				},
				transient: true,
				type: 'update-overlay',
			});
		};

	const handleKeyUp =
		(id: string) => (event: React.KeyboardEvent<SVGElement>) => {
			if (!arrowDelta(event.key) || keyboardGesture.current !== id) {
				return;
			}

			keyboardGesture.current = null;

			const overlay = current(id);

			if (overlay) {
				dispatch({
					id,
					patch: {x: overlay.x, y: overlay.y},
					type: 'update-overlay',
				});

				announceMoved(id);
			}
		};

	const handlePointerDown =
		(id: string) => (event: React.PointerEvent<SVGElement>) => {
			const overlay = current(id);

			if (!overlay) {
				return;
			}

			event.currentTarget.setPointerCapture?.(event.pointerId);

			onSelect(id);

			pointerGesture.current = {
				id,
				startX: event.clientX,
				startY: event.clientY,
				x: overlay.x,
				y: overlay.y,
			};
		};

	const handlePointerMove = (event: React.PointerEvent<SVGElement>) => {
		const gesture = pointerGesture.current;

		if (!gesture) {
			return;
		}

		dispatch({
			id: gesture.id,
			patch: {
				x: gesture.x + (event.clientX - gesture.startX) / zoom,
				y: gesture.y + (event.clientY - gesture.startY) / zoom,
			},
			transient: true,
			type: 'update-overlay',
		});
	};

	const handlePointerUp = () => {
		const gesture = pointerGesture.current;

		if (!gesture) {
			return;
		}

		pointerGesture.current = null;

		const overlay = current(gesture.id);

		if (overlay) {
			dispatch({
				id: gesture.id,
				patch: {x: overlay.x, y: overlay.y},
				type: 'update-overlay',
			});

			announceMoved(gesture.id);
		}
	};

	const commitTextEdit = () => {
		if (!editing) {
			return;
		}

		const overlay = current(editing.id);
		const value = editing.draft.trim();

		setEditing(null);

		if (
			overlay &&
			overlay.kind === 'text' &&
			value &&
			value !== overlay.text
		) {
			dispatch({
				id: editing.id,
				patch: {text: value},
				type: 'update-overlay',
			});

			onAnnounce(t('layer-updated', overlayLabel(overlay)));
		}
	};

	const startManipulation =
		(
			overlay: Overlay,
			kind: 'resize' | 'rotate',
			handleX: number,
			handleY: number,
			edge?: 'e' | 'n' | 's' | 'w'
		) =>
		(event: React.PointerEvent<SVGElement>) => {
			event.stopPropagation();

			event.currentTarget.setPointerCapture?.(event.pointerId);

			onSelect(overlay.id);

			const bounds = overlayBounds(overlay);

			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;

			manipGesture.current = {
				centerX,
				centerY,
				edge,
				id: overlay.id,
				kind,
				overlay,
				startAngle: Math.atan2(handleY - centerY, handleX - centerX),
				startDistance: Math.hypot(
					handleX - centerX,
					handleY - centerY
				),
				startX: event.clientX,
				startY: event.clientY,
			};
		};

	const handleManipulationMove = (
		event: React.PointerEvent<SVGElement>
	) => {
		const gesture = manipGesture.current;

		if (!gesture) {
			return;
		}

		const {centerX, centerY, overlay} = gesture;

		// Pointer position in the overlay's local frame: the handle's
		// start position plus the counter-rotated client delta.

		const [dx, dy] = toLocalDelta(
			(event.clientX - gesture.startX) / zoom,
			(event.clientY - gesture.startY) / zoom,
			overlay.rotation ?? 0
		);

		const pointX =
			centerX +
			gesture.startDistance * Math.cos(gesture.startAngle) +
			dx;
		const pointY =
			centerY +
			gesture.startDistance * Math.sin(gesture.startAngle) +
			dy;

		if (gesture.kind === 'rotate') {
			const degrees =
				(overlay.rotation ?? 0) +
				((Math.atan2(pointY - centerY, pointX - centerX) -
					gesture.startAngle) *
					180) /
					Math.PI;

			let rotation = Math.round(((degrees % 360) + 360) % 360);

			if (event.shiftKey) {
				rotation = (Math.round(rotation / 15) * 15) % 360;
			}

			dispatch({
				id: gesture.id,
				patch: {rotation},
				transient: true,
				type: 'update-overlay',
			});

			return;
		}

		// Edge handles stretch one dimension of a rectangle freely,
		// anchoring the opposite side: the center shifts by half the size
		// change along the dragged axis, rotated into stage space.

		if (gesture.edge && overlay.kind === 'shape') {
			const horizontal = gesture.edge === 'e' || gesture.edge === 'w';
			const sign = gesture.edge === 'e' || gesture.edge === 's' ? 1 : -1;

			const newSize = Math.max(
				horizontal
					? sign * (pointX - centerX) + overlay.width / 2
					: sign * (pointY - centerY) + overlay.height / 2,
				8
			);

			const oldSize = horizontal ? overlay.width : overlay.height;

			const [shiftX, shiftY] = toStageDelta(
				horizontal ? (sign * (newSize - oldSize)) / 2 : 0,
				horizontal ? 0 : (sign * (newSize - oldSize)) / 2,
				overlay.rotation ?? 0
			);

			const width = horizontal ? newSize : overlay.width;
			const height = horizontal ? overlay.height : newSize;

			dispatch({
				id: gesture.id,
				patch: {
					height: Math.round(height),
					width: Math.round(width),
					x: Math.round(centerX + shiftX - width / 2),
					y: Math.round(centerY + shiftY - height / 2),
				},
				transient: true,
				type: 'update-overlay',
			});

			return;
		}

		// Corner resize: proportional by default, anchored at the center,
		// which keeps the geometry stable under rotation. Shift resizes a
		// rectangle's sides freely.

		const scale = Math.max(
			Math.hypot(pointX - centerX, pointY - centerY) /
				gesture.startDistance,
			0.05
		);

		if (overlay.kind === 'sticker') {
			dispatch({
				id: gesture.id,
				patch: {size: Math.max(Math.round(overlay.size * scale), 8)},
				transient: true,
				type: 'update-overlay',
			});
		}
		else if (overlay.kind === 'text') {
			const fontSize = Math.max(Math.round(overlay.fontSize * scale), 8);

			// Keep the estimated text box centered while it scales.

			dispatch({
				id: gesture.id,
				patch: {
					fontSize,
					x:
						centerX -
						textWidth(
							overlay.text,
							overlay.fontFamily,
							fontSize
						) /
							2,
					y: centerY + 0.4 * fontSize,
				},
				transient: true,
				type: 'update-overlay',
			});
		}
		else if (overlay.kind === 'shape') {
			let width;
			let height;

			if (event.shiftKey) {
				width = Math.max(Math.abs(pointX - centerX) * 2, 8);
				height = Math.max(Math.abs(pointY - centerY) * 2, 8);
			}
			else {
				width = Math.max(overlay.width * scale, 8);
				height = Math.max(overlay.height * scale, 8);
			}

			dispatch({
				id: gesture.id,
				patch: {
					height: Math.round(height),
					width: Math.round(width),
					x: Math.round(centerX - width / 2),
					y: Math.round(centerY - height / 2),
				},
				transient: true,
				type: 'update-overlay',
			});
		}
	};

	const handleManipulationUp = () => {
		const gesture = manipGesture.current;

		if (!gesture) {
			return;
		}

		manipGesture.current = null;

		const overlay = current(gesture.id);

		if (overlay) {

			// Commit the whole gesture as one undo step.

			dispatch({
				id: gesture.id,
				patch: {
					rotation: overlay.rotation,
					x: overlay.x,
					y: overlay.y,
				},
				type: 'update-overlay',
			});

			onAnnounce(t('layer-updated', overlayLabel(overlay)));
		}
	};

	return (
		<g>
			<desc id="overlay-instructions">{t('overlay-instructions')}</desc>

			{overlays.map((overlay) => {
				const bounds = overlayBounds(overlay);

				return (
					<g
						key={overlay.id}
						transform={overlayTransform(overlay)}
					>
						{editing?.id !== overlay.id && (
							<OverlayShape overlay={overlay} />
						)}

						{focus?.id === overlay.id ? (
							<FocusRing
								bounds={bounds}
								emphasis={focus.modality}
								zoom={zoom}
							/>
						) : (
							selectedId === overlay.id && (
								<FocusRing
									bounds={bounds}
									emphasis="pointer"
									zoom={zoom}
								/>
							)
						)}

						<rect
							aria-describedby="overlay-instructions"
							aria-label={overlayLabel(overlay)}
							className="overlay-hit"
							data-overlay-id={overlay.id}
							fill="transparent"
							height={bounds.height}
							onBlur={() => setFocus(null)}
							onDoubleClick={
								overlay.kind === 'text'
									? () =>
											setEditing({
												draft: overlay.text,
												id: overlay.id,
											})
									: undefined
							}
							onFocus={(event) => {
								onSelect(overlay.id);

								setFocus({
									id: overlay.id,
									modality: matchesFocusVisible(
										event.currentTarget
									)
										? 'keyboard'
										: 'pointer',
								});
							}}
							onKeyDown={handleKeyDown(overlay.id)}
							onKeyUp={handleKeyUp(overlay.id)}
							onPointerDown={handlePointerDown(overlay.id)}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							role="button"
							tabIndex={0}
							width={bounds.width}
							x={bounds.x}
							y={bounds.y}
						/>

						{editing?.id === overlay.id &&
							overlay.kind === 'text' && (
								<foreignObject
									height={overlay.fontSize * 1.5}
									width={
										textWidth(
											editing.draft || ' ',
											overlay.fontFamily,
											overlay.fontSize
										) +
										overlay.fontSize * 1.2
									}
									x={bounds.x - overlay.fontSize * 0.25}
									y={bounds.y - overlay.fontSize * 0.15}
								>
									<input
										aria-label={t('text-content')}
										autoFocus
										className="overlay-text-editor"
										onBlur={commitTextEdit}
										onChange={(event) =>
											setEditing({
												draft: event.target.value,
												id: overlay.id,
											})
										}
										onKeyDown={(event) => {
											event.stopPropagation();

											if (event.key === 'Enter') {
												commitTextEdit();
											}
											else if (
												event.key === 'Escape'
											) {
												setEditing(null);
											}
										}}
										style={{
											background: editorBackground(
												overlay.color
											),
											color: overlay.color,
											fontFamily: overlay.fontFamily,
											fontSize: overlay.fontSize,
										}}
										value={editing.draft}
									/>
								</foreignObject>
							)}

						{editing?.id !== overlay.id &&
							(selectedId === overlay.id ||
								focus?.id === overlay.id) && (
							<g aria-hidden="true" className="object-handles">
								{RESIZE_CORNERS.map((corner) => {
									const handleX =
										bounds.x + corner.x * bounds.width;
									const handleY =
										bounds.y + corner.y * bounds.height;
									const size = 10 / zoom;

									return (
										<rect
											className="object-handle"
											height={size}
											key={corner.name}
											onPointerDown={startManipulation(
												overlay,
												'resize',
												handleX,
												handleY
											)}
											onPointerMove={
												handleManipulationMove
											}
											onPointerUp={handleManipulationUp}
											strokeWidth={1.5 / zoom}
											style={{cursor: corner.cursor}}
											width={size}
											x={handleX - size / 2}
											y={handleY - size / 2}
										/>
									);
								})}

								{overlay.kind === 'shape' &&
									STRETCH_EDGES.map((edge) => {
										const handleX =
											bounds.x +
											edge.x * bounds.width;
										const handleY =
											bounds.y +
											edge.y * bounds.height;
										const size = 10 / zoom;

										return (
											<rect
												className="object-handle"
												height={size}
												key={edge.name}
												onPointerDown={startManipulation(
													overlay,
													'resize',
													handleX,
													handleY,
													edge.name
												)}
												onPointerMove={
													handleManipulationMove
												}
												onPointerUp={
													handleManipulationUp
												}
												strokeWidth={1.5 / zoom}
												style={{cursor: edge.cursor}}
												width={size}
												x={handleX - size / 2}
												y={handleY - size / 2}
											/>
										);
									})}

								<line
									className="object-rotate-stick"
									strokeWidth={1.5 / zoom}
									x1={bounds.x + bounds.width / 2}
									x2={bounds.x + bounds.width / 2}
									y1={bounds.y}
									y2={bounds.y - 24 / zoom}
								/>

								<circle
									className="object-handle object-handle-rotate"
									cx={bounds.x + bounds.width / 2}
									cy={bounds.y - 24 / zoom}
									onPointerDown={startManipulation(
										overlay,
										'rotate',
										bounds.x + bounds.width / 2,
										bounds.y - 24 / zoom
									)}
									onPointerMove={handleManipulationMove}
									onPointerUp={handleManipulationUp}
									r={6 / zoom}
									strokeWidth={1.5 / zoom}
								/>
							</g>
						)}
					</g>
				);
			})}
		</g>
	);
}
