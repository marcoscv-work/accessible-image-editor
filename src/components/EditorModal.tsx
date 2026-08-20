/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayModal, {useModal} from '@clayui/modal';
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import {EditorConfig, resolveConfig} from '../editorConfig';
import {t} from '../i18n';
import {anchoredScroll} from '../imaging/geometry';
import {LoadedImage} from '../imaging/loadImage';
import {
	redoLabel,
	undoLabel,
} from '../state/editorReducer';
import {nextId} from '../state/ids';
import {CropRect, EditState, rotatedSize} from '../state/types';
import {useAnnouncer} from './Announcer';
import {BottomBar} from './BottomBar';
import {EditorSidebar} from './EditorSidebar';
import {ShortcutsDialog} from './ShortcutsDialog';
import {Workspace} from './Workspace';
import {useEditorHistory} from './hooks/useEditorHistory';
import {useOverlayClipboard} from './hooks/useOverlayClipboard';
import {useOverlaySelection} from './hooks/useOverlaySelection';
import {useSaveController} from './hooks/useSaveController';
import {
	EditorInstanceProvider,
	EditorRootProvider,
	nextEditorInstancePrefix,
} from './instance';

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

/**
 * What a save hands the host: the encoded image, a suggested file name,
 * and the parametric state that produced it, so the host can persist the
 * recipe alongside the pixels and reopen the edit later.
 */
export interface EditorSaveResult {
	blob: Blob;
	fileName: string;
	state: EditState;
}

interface Props {
	image: LoadedImage;
	onClose: () => void;

	/**
	 * Where the edited image goes. May return a promise: the editor
	 * shows the saving state until it settles, closes on success, and
	 * stays open showing the failure on a throw. The signal aborts when
	 * the editor is dismissed mid-save, so an upload can be cancelled.
	 * The editor itself never downloads; the demo shell passes an
	 * adapter that does.
	 */
	onSave: (
		result: EditorSaveResult,
		signal: AbortSignal
	) => Promise<void> | void;

	/**
	 * Which editing blocks and tools to expose; anything omitted keeps
	 * its default, so `{}` is the complete editor.
	 */
	config?: EditorConfig;
}

export default function EditorModal({config, image, onClose, onSave}: Props) {
	// Stable across renders, so the galleries below can skip re-rendering
	// their cards while a crop is being dragged.

	const enabled = useMemo(() => resolveConfig(config), [config]);

	// Every DOM id this instance mints carries this prefix, so a second
	// editor on the page keeps its own labels, descriptions and SVG
	// references to itself.

	const [instancePrefix] = useState(nextEditorInstancePrefix);

	const eid = useCallback(
		(name: string) => instancePrefix + name,
		[instancePrefix]
	);

	const announce = useAnnouncer();

	const {observer, onClose: closeModal} = useModal({onClose});

	// Declared before the history hook so its undo net can consult it;
	// synced right after the save controller below.

	const savingRef = useRef(false);

	const {dispatch, editorRef, handleUndoShortcut, history, redo, undo} =
		useEditorHistory(image, enabled, announce, () => savingRef.current);

	const state = history.present;

	const {
		layerProportional,
		multiSelectedIds,
		selectOverlay,
		selectedOverlayId,
		setLayerProportional,
		setSelectedOverlayId,
		toggleMultiSelect,
	} = useOverlaySelection(state.overlays, announce);

	const {copyOverlay, pasteOverlay} = useOverlayClipboard(
		state,
		dispatch,
		setSelectedOverlayId,
		announce,
		() => editorRef.current ?? document
	);

	const {handleSave, saveError, saving} = useSaveController(
		image,
		state,
		onSave,
		announce,
		closeModal
	);

	savingRef.current = saving;

	// While the save promise is pending, the editable surface goes
	// inert: a change made after the snapshot was exported would be
	// silently discarded when the editor closes on success. The modal
	// header's close button stays live on purpose, as the abort hatch.
	// Attribute, not prop: React 18 does not know `inert`.

	useEffect(() => {
		editorRef.current?.toggleAttribute('inert', saving);
	}, [saving, editorRef]);

	const [zoom, setZoom] = useState(() =>
		fitZoom(null, image.width, image.height)
	);

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

	/**
	 * The editor's own clipboard: one annotation, copied by value. Not
	 * the system clipboard, deliberately, so copying here never asks for
	 * a permission and never overwrites what the user carried in from
	 * elsewhere. Each paste nudges the stored position, so repeated
	 * pastes cascade instead of stacking invisibly.
	 */

	/*
	 * The selected annotation's padlock, here for the same reason: the
	 * stage offers corners only while it is on. A picture arrives locked,
	 * a shape free, and choosing another layer starts again from that.
	 */

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
			(editorRef.current ?? document)
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
	// so the new section enters the view, and scroll further when the
	// selected layer's properties push the Layers title past the fold
	// anyway.
	//
	// Measured a frame later: the selection's properties render in their
	// own commit, and a distance taken before they land describes a
	// sidebar that is about to change height. This scrolls the sidebar
	// explicitly rather than through scrollIntoView, which walks up the
	// ancestors and would also scroll the modal itself, pushing the
	// header out of sight.

	const sidebarRef = useRef<HTMLElement>(null);

	const previousOverlayCount = useRef(0);

	useEffect(() => {
		const first =
			previousOverlayCount.current === 0 && state.overlays.length > 0;

		previousOverlayCount.current = state.overlays.length;

		if (!first) {
			return;
		}

		// One instant anchor, a frame after the commit so the selected
		// layer's properties have rendered. Instant rather than smooth,
		// because a smooth scroll is an animation the browser may cancel
		// under load; and only the sidebar's own scroll moves, never an
		// ancestor's, which is why this is a scrollTo and not a
		// scrollIntoView.

		const frame = requestAnimationFrame(() => {
			const sidebar = sidebarRef.current;
			const annotateTitle = document.getElementById(
				eid('annotate-panel-title')
			);

			if (!sidebar || !annotateTitle) {
				return;
			}

			sidebar.scrollTo({
				top:
					sidebar.scrollTop +
					annotateTitle.getBoundingClientRect().top -
					sidebar.getBoundingClientRect().top,
			});
		});

		return () => cancelAnimationFrame(frame);
	}, [state.overlays.length, eid]);

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




	return (
		<EditorInstanceProvider value={instancePrefix}>
			<EditorRootProvider value={editorRef}>
			<ClayModal
				className="image-editor-modal"
				observer={observer}
				size="full-screen"
			>
				<ClayModal.Header closeButtonAriaLabel={t('close')} withTitle>
					{t('editing-image')}
				</ClayModal.Header>

				<div
					className="image-editor"
					onKeyDown={handleUndoShortcut}
					ref={editorRef}
				>
					<div className="editor-main">
						<Workspace
							aspectLocked={aspectLocked}
							dispatch={dispatch}
							drawing={Boolean(drawing)}
							guidedDrawing={drawing?.guided}
							image={image}
							multiSelectedIds={multiSelectedIds}
							onAnnounce={announce}
							onCenterCrop={centerCrop}
							onCopyOverlay={copyOverlay}
							onFinishDrawing={finishDrawing}
							onMultiSelectToggle={toggleMultiSelect}
							onPasteOverlay={pasteOverlay}
							onSelectOverlay={selectOverlay}
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
							multiSelectedIds={multiSelectedIds}
							onAnnounce={announce}
							onAspectLockedChange={setAspectLocked}
							onProportionalChange={setLayerProportional}
							onSelectOverlay={selectOverlay}
							onStartDrawing={(via) =>
								setDrawing({guided: via === 'keyboard'})
							}
							proportional={layerProportional}
							selectedOverlayId={selectedOverlayId}
							sidebarRef={sidebarRef}
							state={state}
						/>
					</div>

					{saveError && (
						<div
							className="alert alert-danger editor-save-error"
							role="alert"
						>
							{t('save-failed')}
						</div>
					)}

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
			</EditorRootProvider>
		</EditorInstanceProvider>
	);
}
