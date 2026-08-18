/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayModal, {useModal} from '@clayui/modal';
import React, {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react';

import {EditorConfig, resolveConfig} from '../editorConfig';
import {t} from '../i18n';
import {downloadBlob, exportEditedImage} from '../imaging/exportImage';
import {anchoredScroll} from '../imaging/geometry';
import {LoadedImage} from '../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
	redoLabel,
	undoLabel,
} from '../state/editorReducer';
import {nextId} from '../state/ids';
import {CropRect, rotatedSize} from '../state/types';
import {useAnnouncer} from './Announcer';
import {BottomBar} from './BottomBar';
import {EditorSidebar} from './EditorSidebar';
import {ShortcutsDialog} from './ShortcutsDialog';
import {Workspace} from './Workspace';

const ZOOM_LEVELS = [0.05, 0.1, 0.15, 0.25, 0.35, 0.5, 0.75, 1, 1.5, 2, 3];

/**
 * The stage padding around the image inside the workspace (see
 * .editor-stage in styles.css), counted on both sides.
 */
const STAGE_PADDING = 48;

const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/**
 * Zoom that fits the given size inside the actual workspace element,
 * which already accounts for the header, the bottom bar, and the sidebar.
 * Falls back to a window-based estimate until the workspace exists.
 *
 * `max` caps the result: fitting the whole image never upscales it past
 * its natural size, while focusing on a crop is allowed to zoom in so the
 * region fills the view.
 */
function fitZoom(
	workspace: HTMLElement | null,
	width: number,
	height: number,
	max = 1
): number {
	/*
	 * The workspace scrolls on both axes at all times (see the
	 * stylesheet), so this measurement is the same before and after the
	 * zoom it is being taken for.
	 */

	const availableWidth = workspace
		? workspace.clientWidth - STAGE_PADDING
		: Math.max(window.innerWidth - 360, 240);
	const availableHeight = workspace
		? workspace.clientHeight - STAGE_PADDING
		: Math.max(window.innerHeight - 200, 240);

	const fit = Math.min(availableWidth / width, availableHeight / height, max);

	return Math.max(Math.floor(fit * 100) / 100, 0.01);
}

function stepZoom(zoom: number, direction: -1 | 1): number {
	if (direction === 1) {
		return ZOOM_LEVELS.find((level) => level > zoom + 1e-6) ?? zoom;
	}

	const smaller = ZOOM_LEVELS.filter((level) => level < zoom - 1e-6);

	return smaller.length ? smaller[smaller.length - 1] : zoom;
}

interface Props {
	image: LoadedImage;
	onClose: () => void;

	/**
	 * Which editing blocks and tools to expose; anything omitted keeps
	 * its default, so `{}` is the complete editor.
	 */
	config?: EditorConfig;
}

export default function EditorModal({config, image, onClose}: Props) {
	// Stable across renders, so the galleries below can skip re-rendering
	// their cards while a crop is being dragged.

	const enabled = useMemo(() => resolveConfig(config), [config]);

	const announce = useAnnouncer();

	const {observer, onClose: closeModal} = useModal({onClose});

	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		initialHistory(image.width, image.height)
	);

	const [zoom, setZoom] = useState(() =>
		fitZoom(null, image.width, image.height)
	);
	const [saving, setSaving] = useState(false);

	/*
	 * Kept here rather than in the panel, because the marquee honours it
	 * too: with the proportions locked the stage offers corners only.
	 */

	const [aspectLocked, setAspectLocked] = useState(false);

	/**
	 * Whether the stage is in drawing mode, and how it was entered: a
	 * keyboard entry runs the guided line, a pointer entry the free pen.
	 * Both end in the same stroke overlay.
	 */
	const [drawing, setDrawing] = useState<null | {guided: boolean}>(null);

	/*
	 * The selected annotation's padlock, here for the same reason: the
	 * stage offers corners only while it is on. A picture arrives locked,
	 * a shape free, and choosing another layer starts again from that.
	 */

	const [layerProportional, setLayerProportional] = useState(false);
	const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
		null
	);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	/**
	 * True while the view already frames the crop, so the recenter
	 * control can hide instead of offering a no-op.
	 */
	const [cropFramed, setCropFramed] = useState(false);

	const programmaticScrollRef = useRef(false);

	const workspaceRef = useRef<HTMLDivElement | null>(null);

	/**
	 * While true, the zoom tracks the workspace size (initial fit, modal
	 * settling, window resizes, rotation). Manual zoom steps switch to
	 * user control; the fit button switches back.
	 */
	const autoFitRef = useRef(true);

	const state = history.present;

	const finishDrawing = (result: {points: number[]; smooth: boolean} | null) => {
		setDrawing(null);

		if (!result) {
			return;
		}

		// Stored relative to the bounding origin, so moving the stroke is
		// the same x/y patch as moving anything else.

		let minX = Infinity;
		let minY = Infinity;

		for (let index = 0; index < result.points.length; index += 2) {
			minX = Math.min(minX, result.points[index]);
			minY = Math.min(minY, result.points[index + 1]);
		}

		const id = nextId('stroke');

		dispatch({
			overlay: {
				color: '#0b5fff',
				id,
				kind: 'stroke',
				points: result.points.map((value, index) =>
					Math.round(
						(value - (index % 2 === 0 ? minX : minY)) * 10
					) / 10
				),
				smooth: result.smooth,
				width: Math.max(
					3,
					Math.round(
						Math.min(state.crop.width, state.crop.height) * 0.008
					)
				),
				x: Math.round(minX),
				y: Math.round(minY),
			},
			type: 'add-overlay',
		});

		announce(t('annotation-added', t('overlay-stroke-label')));

		window.setTimeout(() => {
			document
				.querySelector<HTMLElement>(`[data-overlay-id="${id}"]`)
				?.focus({preventScroll: true});
		}, 0);
	};

	const stageBoundsRef = useRef(rotatedSize(state));

	stageBoundsRef.current = rotatedSize(state);

	useEffect(() => {
		announce(t('editor-loaded', image.width, image.height));
	}, [announce, image]);

	// ClayModal mounts its children only after the opening animation, so
	// the workspace cannot be measured at EditorModal mount time. A
	// callback ref attaches the ResizeObserver exactly when the element
	// appears, and the observer keeps the fit in sync with the modal
	// settling and later window resizes.

	const resizeObserverRef = useRef<ResizeObserver | null>(null);

	const handleWorkspaceRef = useCallback(
		(element: HTMLDivElement | null) => {
			resizeObserverRef.current?.disconnect();
			resizeObserverRef.current = null;

			workspaceRef.current = element;

			if (!element) {
				return;
			}

			const observer = new ResizeObserver(() => {
				if (autoFitRef.current) {
					setZoom(
						fitZoom(
							element,
							stageBoundsRef.current.width,
							stageBoundsRef.current.height
						)
					);
				}
			});

			observer.observe(element);

			resizeObserverRef.current = observer;
		},
		[]
	);

	// When the first annotation appears, the Layers panel materializes
	// below the fold: bring the Annotate title to the top of the sidebar
	// so the new section enters the view.
	//
	// This scrolls the sidebar explicitly rather than through
	// scrollIntoView, which walks up the ancestors and would also scroll
	// the modal itself, pushing the header out of sight.

	const sidebarRef = useRef<HTMLElement>(null);

	const previousOverlayCount = useRef(0);

	useEffect(() => {
		const sidebar = sidebarRef.current;
		const title = document.getElementById('annotate-panel-title');

		if (
			previousOverlayCount.current === 0 &&
			state.overlays.length > 0 &&
			sidebar &&
			title
		) {
			const delta =
				title.getBoundingClientRect().top -
				sidebar.getBoundingClientRect().top;

			sidebar.scrollTo({
				behavior: 'smooth',
				top: sidebar.scrollTop + delta,
			});
		}

		previousOverlayCount.current = state.overlays.length;
	}, [state.overlays.length]);

	useEffect(() => setCropFramed(false), [state.crop]);

	// Rotation swaps the stage bounds without resizing the workspace.

	useEffect(() => {
		if (autoFitRef.current && workspaceRef.current) {
			setZoom(
				fitZoom(
					workspaceRef.current,
					stageBoundsRef.current.width,
					stageBoundsRef.current.height
				)
			);
		}
	}, [state.rotation]);

	/**
	 * The last pointer position over the workspace, in its coordinates, and
	 * null whenever the pointer is elsewhere, which is the normal state for
	 * someone working from the keyboard.
	 */
	const pointerRef = useRef<{x: number; y: number} | null>(null);

	const handleWorkspacePointerMove = (event: React.PointerEvent) => {
		const element = workspaceRef.current;

		if (!element) {
			return;
		}

		const rect = element.getBoundingClientRect();

		pointerRef.current = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	};

	const handleWorkspacePointerLeave = () => {
		pointerRef.current = null;
	};

	/**
	 * A zoom step keeps one point of the image still: the one under the
	 * pointer while it is over the stage, and the centre of the view
	 * otherwise. Anchoring the keyboard shortcut to a pointer parked
	 * somewhere else would drag the image to a place nobody chose, so the
	 * fallback is the one place the reader is certainly looking at.
	 */
	const pendingAnchorRef = useRef<{
		anchor: {x: number; y: number};
		from: number;
		scroll: {left: number; top: number};
		zoom: number;
	} | null>(null);

	const zoomBy = (direction: -1 | 1) => {
		autoFitRef.current = false;

		setCropFramed(false);

		const next = stepZoom(zoom, direction);

		if (next === zoom) {
			return;
		}

		const element = workspaceRef.current;

		if (element) {
			const pointer = pointerRef.current;

			const inside =
				pointer &&
				pointer.x >= 0 &&
				pointer.y >= 0 &&
				pointer.x <= element.clientWidth &&
				pointer.y <= element.clientHeight;

			pendingAnchorRef.current = {
				anchor:
					inside && pointer
						? pointer
						: {
								x: element.clientWidth / 2,
								y: element.clientHeight / 2,
							},
				from: zoom,
				scroll: {left: element.scrollLeft, top: element.scrollTop},
				zoom: next,
			};
		}

		setZoom(next);
		announce(t('zoom-level', Math.round(next * 100)));
	};

	/**
	 * Actual size, the way every editor spells it: 100%, no fitting.
	 */
	const zoomToActual = () => {
		autoFitRef.current = false;

		setCropFramed(false);
		setZoom(1);

		announce(t('zoom-level', 100));
	};

	const zoomToFit = () => {
		autoFitRef.current = true;

		setCropFramed(false);

		const bounds = rotatedSize(state);

		const next = fitZoom(
			workspaceRef.current,
			bounds.width,
			bounds.height
		);

		setZoom(next);
		announce(t('zoom-level', Math.round(next * 100)));
	};

	/**
	 * Focus the view on the crop: fit that region to the workspace and
	 * scroll it to the center. A view operation only, so it never enters
	 * the edit history.
	 */
	const pendingCenterRef = useRef<{crop: CropRect; zoom: number} | null>(
		null
	);

	const scrollCropToCenter = (crop: CropRect, level: number) => {
		const element = workspaceRef.current;

		if (!element) {
			return;
		}

		programmaticScrollRef.current = true;

		element.scrollLeft =
			STAGE_PADDING / 2 +
			(crop.x + crop.width / 2) * level -
			element.clientWidth / 2;
		element.scrollTop =
			STAGE_PADDING / 2 +
			(crop.y + crop.height / 2) * level -
			element.clientHeight / 2;
	};

	// The scroll can only be applied once the stage has re-laid out at
	// the new zoom, or the browser clamps it to the previous scroll
	// range. Effects run after the DOM update, so this is the safe spot.

	useEffect(() => {
		const pending = pendingCenterRef.current;

		if (pending && pending.zoom === zoom) {
			pendingCenterRef.current = null;

			scrollCropToCenter(pending.crop, zoom);
		}

		const anchored = pendingAnchorRef.current;
		const element = workspaceRef.current;

		if (anchored && anchored.zoom === zoom && element) {
			pendingAnchorRef.current = null;

			const scroll = anchoredScroll({
				anchor: anchored.anchor,
				next: zoom,
				padding: STAGE_PADDING,
				scroll: anchored.scroll,
				zoom: anchored.from,
			});

			programmaticScrollRef.current = true;

			element.scrollLeft = scroll.left;
			element.scrollTop = scroll.top;
		}
	});

	const centerCrop = () => {
		autoFitRef.current = false;

		const element = workspaceRef.current;

		if (!element) {
			return;
		}

		const {crop} = state;

		const next = fitZoom(
			element,
			crop.width,
			crop.height,
			MAX_ZOOM
		);

		if (next === zoom) {
			scrollCropToCenter(crop, next);
		}
		else {
			pendingCenterRef.current = {crop, zoom: next};

			setZoom(next);
		}

		setCropFramed(true);

		announce(t('crop-centered', Math.round(next * 100)));
	};

	const undo = () => {
		const label = undoLabel(history);

		if (!label) {
			return;
		}

		dispatch({type: 'undo'});

		announce(t('undo-done', label));
	};

	const redo = () => {
		const label = redoLabel(history);

		if (!label) {
			return;
		}

		dispatch({type: 'redo'});

		announce(t('redo-done', label));
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (
			!(event.metaKey || event.ctrlKey) ||
			event.key.toLowerCase() !== 'z'
		) {
			return;
		}

		event.preventDefault();

		if (event.shiftKey) {
			redo();
		}
		else {
			undo();
		}
	};

	useEffect(() => {
		const overlay = state.overlays.find(
			(candidate) => candidate.id === selectedOverlayId
		);

		setLayerProportional(overlay?.kind === 'image');

		// Only when the selection changes: the padlock is the reader's to
		// set once they are on a layer.

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedOverlayId]);

	const handleSave = async () => {
		setSaving(true);

		try {
			const result = await exportEditedImage(image, state);

			downloadBlob(result.blob, result.fileName);

			announce(t('image-saved', result.fileName));

			closeModal();
		}
		catch {
			announce(t('save-failed'));
		}
		finally {
			setSaving(false);
		}
	};

	return (
		<>
			<ClayModal
				className="image-editor-modal"
				observer={observer}
				size="full-screen"
			>
				<ClayModal.Header closeButtonAriaLabel={t('close')} withTitle>
					{t('editing-image')}
				</ClayModal.Header>

				<div className="image-editor" onKeyDown={handleKeyDown}>
					<div className="editor-main">
						<Workspace
							aspectLocked={aspectLocked}
							dispatch={dispatch}
							drawing={Boolean(drawing)}
							guidedDrawing={drawing?.guided}
							image={image}
							onAnnounce={announce}
							onCenterCrop={centerCrop}
							onFinishDrawing={finishDrawing}
							onSelectOverlay={setSelectedOverlayId}
							onWorkspacePointerLeave={handleWorkspacePointerLeave}
							onWorkspacePointerMove={handleWorkspacePointerMove}
							onWorkspaceScroll={() => {
								if (programmaticScrollRef.current) {
									programmaticScrollRef.current = false;
								}
								else {
									setCropFramed(false);
								}
							}}
							onZoom={zoomBy}
							onZoomActual={zoomToActual}
							onZoomFit={zoomToFit}
							proportional={layerProportional}
							selectedOverlayId={selectedOverlayId}
							showCrop={enabled.crop.enabled}
							showRecenter={!cropFramed}
							state={state}
							workspaceRef={handleWorkspaceRef}
							zoom={zoom}
						/>

						<EditorSidebar
							aspectLocked={aspectLocked}
							dispatch={dispatch}
							enabled={enabled}
							image={image}
							onAnnounce={announce}
							onAspectLockedChange={setAspectLocked}
							onProportionalChange={setLayerProportional}
							onSelectOverlay={setSelectedOverlayId}
							onStartDrawing={(via) =>
								setDrawing({guided: via === 'keyboard'})
							}
							proportional={layerProportional}
							selectedOverlayId={selectedOverlayId}
							sidebarRef={sidebarRef}
							state={state}
						/>
					</div>

					<BottomBar
						canRedo={!!redoLabel(history)}
						canUndo={!!undoLabel(history)}
						dispatch={dispatch}
						onAnnounce={announce}
						onCancel={closeModal}
						onRedo={redo}
						onSave={handleSave}
						onShowShortcuts={() => setShortcutsOpen(true)}
						onUndo={undo}
						onZoom={zoomBy}
						onZoomFit={zoomToFit}
						ratio={state.ratio}
						ratios={enabled.crop.ratios}
						saving={saving}
						showRotate={enabled.crop.rotate}
						zoom={zoom}
					/>
				</div>
			</ClayModal>

			<ShortcutsDialog
				onOpenChange={setShortcutsOpen}
				open={shortcutsOpen}
			/>
		</>
	);
}
