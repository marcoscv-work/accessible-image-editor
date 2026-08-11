import React, {useRef, useState} from 'react';

import {t} from '../i18n';
import {
	OverlayShape,
	overlayBounds,
	overlayLabel,
	overlayTransform,
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

interface Props {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	overlays: Overlay[];
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
	overlays,
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
						<OverlayShape overlay={overlay} />

						{focus?.id === overlay.id && (
							<FocusRing
								bounds={bounds}
								emphasis={focus.modality}
								zoom={zoom}
							/>
						)}

						<rect
							aria-describedby="overlay-instructions"
							aria-label={overlayLabel(overlay)}
							className="overlay-hit"
							fill="transparent"
							height={bounds.height}
							onBlur={() => setFocus(null)}
							onFocus={(event) =>
								setFocus({
									id: overlay.id,
									modality: matchesFocusVisible(
										event.currentTarget
									)
										? 'keyboard'
										: 'pointer',
								})
							}
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
					</g>
				);
			})}
		</g>
	);
}
