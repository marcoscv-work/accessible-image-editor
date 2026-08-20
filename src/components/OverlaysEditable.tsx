/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {arrowDelta} from '../imaging/geometry';
import {
	OverlayShape,
	overlayBounds,
	overlayHitBox,
	overlayLabel,
	overlayRotation,
	overlayTransform,
	textWidth,
} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {ArrowOverlay, Overlay, isBoxOverlay} from '../state/types';
import {FocusModality, FocusRing, matchesFocusVisible} from './FocusRing';
import {OverlayTextEditor} from './OverlayTextEditor';
import {useEditorId, useEditorRoot} from './instance';

import type {RedactSource} from '../imaging/overlayShapes';

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
 * The smallest target the editor will offer, in screen pixels (WCAG 2.2,
 * 2.5.8). Divided by the zoom wherever it is used, since the stage is
 * drawn in image units.
 */
const MINIMUM_TARGET = 24;

const STRETCH_EDGES = [
	{cursor: 'ns-resize', name: 'n', x: 0.5, y: 0},
	{cursor: 'ew-resize', name: 'e', x: 1, y: 0.5},
	{cursor: 'ns-resize', name: 's', x: 0.5, y: 1},
	{cursor: 'ew-resize', name: 'w', x: 0, y: 0.5},
] as const;

/**
 * An arrow is placed by its two ends rather than by a box, so those are
 * the handles it offers.
 */
const ARROW_ENDS = ['tail', 'tip'] as const;

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

	/**
	 * Which end of an arrow is being dragged, for the endpoint gesture.
	 */
	end?: 'tail' | 'tip';

	id: string;
	kind: 'endpoint' | 'resize' | 'rotate';
	overlay: Overlay;
	startAngle: number;
	startDistance: number;
	startX: number;
	startY: number;
}

interface Props {

	/**
	 * Whether the selected annotation keeps its proportions. With it on
	 * the side handles are not offered, since stretching one axis is what
	 * the padlock forbids, and a corner keeps the ratio without Shift.
	 */
	proportional: boolean;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;

	/**
	 * The move-together set. Shift+click builds it, and it grants exactly
	 * one power: dragging or arrow-keying any member moves them all.
	 * Nothing else applies to a group, which is why the manipulation
	 * handles disappear while one exists.
	 */
	multiSelectedIds: string[];

	/**
	 * Copies the annotation to the editor's clipboard (Ctrl/Cmd+C on the
	 * focused node).
	 */
	onCopy?: (id: string) => void;

	onMultiSelectToggle: (id: string) => void;

	onSelect: (id: string | null) => void;
	overlays: Overlay[];
	redactSource: RedactSource;
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
	multiSelectedIds,
	onAnnounce,
	onCopy,
	onMultiSelectToggle,
	onSelect,
	overlays,
	proportional,
	redactSource,
	selectedId,
	zoom,
}: Props) {
	const eid = useEditorId();

	const editorRoot = useEditorRoot();

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

	const multiSet = new Set(multiSelectedIds);

	/**
	 * What a move gesture on this node carries: the whole set when the
	 * node belongs to it, the node alone otherwise.
	 */
	const movingIds = (id: string) =>
		multiSet.has(id) && multiSet.size > 1 ? [...multiSet] : [id];

	const announceMoved = (id: string) => {
		const overlay = current(id);

		if (overlay) {
			onAnnounce(
				t(
					'x-moved-to-x-y',
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

				// The properties panel is rendered by the parent in
				// response to that selection, so the focus has to wait for
				// the render rather than for the end of this turn: the
				// panel is often already open, but it is not always.

				window.setTimeout(() => {

					// The properties live inside the Layers section, and a
					// collapsed section keeps them at display none, where a
					// focus() is a silent no-op: the jump would select the
					// layer and appear to do nothing at all. Opening the
					// disclosure is part of honouring the key.

					const header = editorRoot()
						.querySelector(`#${eid('layers-panel-title')}`)
						?.closest('button');

					if (header?.getAttribute('aria-expanded') === 'false') {
						(header as HTMLButtonElement).click();
					}

					window.requestAnimationFrame(() => {
						editorRoot()
							.querySelector<HTMLElement>(
								'.editor-layer-properties input, .editor-layer-properties select'
							)
							?.focus();
					});
				}, 0);

				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === 'c'
			) {

				// Copy, not cut: the original stays. Paste is handled by
				// the workspace, which this event bubbles up to.

				onCopy?.(id);

				return;
			}

			if (event.key === 'Delete' || event.key === 'Backspace') {
				event.preventDefault();

				// The node under focus is about to unmount, and focus
				// falling to the body would take the undo shortcut down
				// with it: the workspace inherits it instead.

				const workspace = (
					event.currentTarget as SVGElement
				).closest<HTMLElement>('.editor-workspace');

				window.setTimeout(() => workspace?.focus(), 0);

				// Delete on a group member takes the whole group: one
				// entry, one undo, every ring accounted for.

				if (multiSet.has(id) && multiSet.size > 1) {
					dispatch({ids: [...multiSet], type: 'remove-overlays'});

					onAnnounce(t('x-annotations-removed', multiSet.size));

					onSelect(null);

					return;
				}

				const overlay = current(id);

				dispatch({id, type: 'remove-overlay'});

				if (overlay) {
					onAnnounce(
						t('x-removed-from-the-image', overlayLabel(overlay))
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

			// A member of the move-together set never travels alone.

			if (multiSet.has(id) && multiSet.size > 1) {
				dispatch({
					dx: delta[0] * step,
					dy: delta[1] * step,
					ids: movingIds(id),
					transient: true,
					type: 'move-overlays',
				});

				return;
			}

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

			if (multiSet.has(id) && multiSet.size > 1) {
				dispatch({
					dx: 0,
					dy: 0,
					ids: movingIds(id),
					type: 'move-overlays',
				});

				onAnnounce(t('x-annotations-moved-together', multiSet.size));

				return;
			}

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

			// Shift+click curates the move-together set instead of
			// starting a drag: membership is a decision, not a gesture.

			if (event.shiftKey) {
				onMultiSelectToggle(id);

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

		if (multiSet.has(gesture.id) && multiSet.size > 1) {

			// The set moves by the pointer's delta since the last event:
			// relative steps, so every member keeps its own place in the
			// formation.

			const dx = (event.clientX - gesture.startX) / zoom;
			const dy = (event.clientY - gesture.startY) / zoom;

			gesture.startX = event.clientX;
			gesture.startY = event.clientY;

			dispatch({
				dx,
				dy,
				ids: movingIds(gesture.id),
				transient: true,
				type: 'move-overlays',
			});

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

	// pointercancel (and a capture lost to the browser) reverts the drag
	// wholesale: transients never became history, so the base state is
	// one dispatch away. lostpointercapture also follows every normal
	// release, after pointerup has already cleared the ref, which is what
	// makes it safe to listen to.

	const cancelPointerGesture = () => {
		if (pointerGesture.current) {
			pointerGesture.current = null;

			dispatch({type: 'cancel-gesture'});
		}
	};

	const cancelManipGesture = () => {
		if (manipGesture.current) {
			manipGesture.current = null;

			dispatch({type: 'cancel-gesture'});
		}
	};

	// Unmounting mid-drag (a panel switch, the modal closing) must not
	// leave a transient half-applied under the next commit.

	useEffect(() => {
		return () => {
			if (pointerGesture.current || manipGesture.current) {
				dispatch({type: 'cancel-gesture'});
			}
		};

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handlePointerUp = () => {
		const gesture = pointerGesture.current;

		if (!gesture) {
			return;
		}

		pointerGesture.current = null;

		if (multiSet.has(gesture.id) && multiSet.size > 1) {
			dispatch({
				dx: 0,
				dy: 0,
				ids: movingIds(gesture.id),
				type: 'move-overlays',
			});

			onAnnounce(t('x-annotations-moved-together', multiSet.size));

			return;
		}

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

			onAnnounce(t('x-updated', overlayLabel(overlay)));
		}
	};

	const startManipulation =
		(
			overlay: Overlay,
			kind: 'endpoint' | 'resize' | 'rotate',
			handleX: number,
			handleY: number,
			edge?: 'e' | 'n' | 's' | 'w',
			end?: 'tail' | 'tip'
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
				end,
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
			overlayRotation(overlay)
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
				overlayRotation(overlay) +
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

		// An arrow is aimed by its ends: dragging one leaves the other
		// where it is. Since the tip is held as a vector, moving the tail
		// has to counter-adjust it, or the whole arrow would travel along
		// with the hand instead of pivoting on its tip.

		if (gesture.kind === 'endpoint' && overlay.kind === 'arrow') {
			const patch =
				gesture.end === 'tip'
					? {
							dx: Math.round(pointX - overlay.x),
							dy: Math.round(pointY - overlay.y),
						}
					: {
							dx: Math.round(overlay.x + overlay.dx - pointX),
							dy: Math.round(overlay.y + overlay.dy - pointY),
							x: Math.round(pointX),
							y: Math.round(pointY),
						};

			dispatch({
				id: gesture.id,
				patch,
				transient: true,
				type: 'update-overlay',
			});

			return;
		}

		// Edge handles stretch one dimension of a rectangle freely,
		// anchoring the opposite side: the center shifts by half the size
		// change along the dragged axis, rotated into stage space.

		if (gesture.edge && isBoxOverlay(overlay)) {
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

		// Corner resize, anchored at the center so the geometry stays
		// stable under rotation. Boxes resize freely by default and keep
		// their proportions with Shift, matching the crop; emoji and text
		// scale proportionally because size is a single value.

		const scale = Math.max(
			Math.hypot(pointX - centerX, pointY - centerY) /
				gesture.startDistance,
			0.05
		);

		if (overlay.kind === 'emoji') {
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
		else if (isBoxOverlay(overlay)) {
			let width;
			let height;

			if (event.shiftKey || proportional) {
				width = Math.max(overlay.width * scale, 8);
				height = Math.max(overlay.height * scale, 8);
			}
			else {
				width = Math.max(Math.abs(pointX - centerX) * 2, 8);
				height = Math.max(Math.abs(pointY - centerY) * 2, 8);
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
				patch:
					overlay.kind === 'arrow'
						? {
								dx: overlay.dx,
								dy: overlay.dy,
								x: overlay.x,
								y: overlay.y,
							}
						: {
								rotation: overlay.rotation,
								x: overlay.x,
								y: overlay.y,
							},
				type: 'update-overlay',
			});

			onAnnounce(t('x-updated', overlayLabel(overlay)));
		}
	};

	return (
		<g>
			<desc id={eid('overlay-instructions')}>{t('overlay-instructions')}</desc>

			{overlays.map((overlay) => {
				const bounds = overlayBounds(overlay);

				// 24 screen pixels, expressed in stage units so the target
				// keeps its size at any zoom.

				const hit = overlayHitBox(overlay, MINIMUM_TARGET / zoom);

				return (
					<g
						key={overlay.id}
						transform={overlayTransform(overlay)}
					>
						{editing?.id !== overlay.id && (
							<OverlayShape
								overlay={overlay}
								redactSource={redactSource}
							/>
						)}

						{focus?.id === overlay.id ? (
							<FocusRing
								bounds={bounds}
								emphasis={focus.modality}
								zoom={zoom}
							/>
						) : (
							(selectedId === overlay.id ||
								multiSet.has(overlay.id)) && (
								<FocusRing
									bounds={bounds}
									emphasis="pointer"
									zoom={zoom}
								/>
							)
						)}

						<rect
							aria-describedby={eid('overlay-instructions')}
							aria-label={overlayLabel(overlay)}
							className="overlay-hit"
							data-overlay-id={overlay.id}
							fill="transparent"
							height={hit.height}
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
							onLostPointerCapture={cancelPointerGesture}
							onPointerCancel={cancelPointerGesture}
							onPointerDown={handlePointerDown(overlay.id)}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							role="button"
							tabIndex={0}
							width={hit.width}
							x={hit.x}
							y={hit.y}
						/>

						{editing?.id === overlay.id &&
							overlay.kind === 'text' && (
								<OverlayTextEditor
									bounds={bounds}
									draft={editing.draft}
									onCancel={() => setEditing(null)}
									onChange={(draft) =>
										setEditing({draft, id: overlay.id})
									}
									onCommit={commitTextEdit}
									overlay={overlay}
								/>
							)}

						{editing?.id !== overlay.id &&
							multiSet.size <= 1 &&
							(selectedId === overlay.id ||
								focus?.id === overlay.id) && (
							<g aria-hidden="true" className="object-handles">
								{overlay.kind === 'arrow' ? (
									ARROW_ENDS.map((end) => {
										const arrow = overlay as ArrowOverlay;

										const handleX =
											arrow.x + (end === 'tip' ? arrow.dx : 0);
										const handleY =
											arrow.y + (end === 'tip' ? arrow.dy : 0);

										return (
											<circle
												className="object-handle"
												cx={handleX}
												cy={handleY}
												key={end}
												onPointerCancel={cancelManipGesture}
												onPointerDown={startManipulation(
													overlay,
													'endpoint',
													handleX,
													handleY,
													undefined,
													end
												)}
												onPointerMove={handleManipulationMove}
												onPointerUp={handleManipulationUp}
												r={6 / zoom}
												strokeWidth={1.5 / zoom}
												style={{cursor: 'move'}}
											/>
										);
									})
								) : (
									<>
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
													onPointerCancel={cancelManipGesture}
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

										{isBoxOverlay(overlay) &&
											!proportional &&
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
														onPointerCancel={
															cancelManipGesture
														}
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
											onPointerCancel={cancelManipGesture}
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
									</>
								)}
							</g>
						)}
					</g>
				);
			})}
		</g>
	);
}
