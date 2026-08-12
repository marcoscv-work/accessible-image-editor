/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayModal, {useModal} from '@clayui/modal';
import React, {
	useCallback,
	useEffect,
	useReducer,
	useRef,
	useState,
} from 'react';

import {t} from '../i18n';
import {downloadBlob, exportEditedImage} from '../imaging/exportImage';
import {LoadedImage} from '../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
	redoLabel,
	undoLabel,
} from '../state/editorReducer';
import {CropRect, rotatedSize} from '../state/types';
import {AdjustPanel} from './AdjustPanel';
import {AnnotatePanel} from './AnnotatePanel';
import {useAnnouncer} from './Announcer';
import {BottomBar} from './BottomBar';
import {CropPanel} from './CropPanel';
import {FilterGallery} from './FilterGallery';
import {LayersPanel} from './LayersPanel';
import {ShortcutsDialog} from './ShortcutsDialog';
import {Workspace} from './Workspace';

const ZOOM_LEVELS = [0.05, 0.1, 0.15, 0.25, 0.35, 0.5, 0.75, 1, 1.5, 2, 3];

/**
 * The stage padding around the image inside the workspace (see
 * .editor-stage in styles.css), counted on both sides.
 */
const STAGE_PADDING = 48;

/**
 * Zoom that fits the image inside the actual workspace element, which
 * already accounts for the header, the bottom bar, and the sidebar.
 * Falls back to a window-based estimate until the workspace exists.
 */
function fitZoom(
	workspace: HTMLElement | null,
	width: number,
	height: number
): number {
	const availableWidth = workspace
		? workspace.clientWidth - STAGE_PADDING
		: Math.max(window.innerWidth - 360, 240);
	const availableHeight = workspace
		? workspace.clientHeight - STAGE_PADDING
		: Math.max(window.innerHeight - 200, 240);

	const fit = Math.min(availableWidth / width, availableHeight / height, 1);

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
}

export default function EditorModal({image, onClose}: Props) {
	const announce = useAnnouncer();

	const {observer, onClose: closeModal} = useModal({onClose});

	const [history, dispatch] = useReducer(editorReducer, undefined, () =>
		initialHistory(image.width, image.height)
	);

	const [zoom, setZoom] = useState(() =>
		fitZoom(null, image.width, image.height)
	);
	const [saving, setSaving] = useState(false);
	const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
		null
	);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	const workspaceRef = useRef<HTMLDivElement | null>(null);

	/**
	 * While true, the zoom tracks the workspace size (initial fit, modal
	 * settling, window resizes, rotation). Manual zoom steps switch to
	 * user control; the fit button switches back.
	 */
	const autoFitRef = useRef(true);

	const state = history.present;

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
	// below the fold: scroll the Annotate title to the top so the new
	// section enters the sidebar viewport.

	const previousOverlayCount = useRef(0);

	useEffect(() => {
		if (previousOverlayCount.current === 0 && state.overlays.length > 0) {
			document
				.getElementById('annotate-panel-title')
				?.scrollIntoView?.({behavior: 'smooth', block: 'start'});
		}

		previousOverlayCount.current = state.overlays.length;
	}, [state.overlays.length]);

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

	const zoomBy = (direction: -1 | 1) => {
		autoFitRef.current = false;

		const next = stepZoom(zoom, direction);

		if (next !== zoom) {
			setZoom(next);
			announce(t('zoom-level', Math.round(next * 100)));
		}
	};

	const zoomToFit = () => {
		autoFitRef.current = true;

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
	});

	const centerCrop = () => {
		autoFitRef.current = false;

		const element = workspaceRef.current;

		if (!element) {
			return;
		}

		const {crop} = state;

		const next = fitZoom(element, crop.width, crop.height);

		if (next === zoom) {
			scrollCropToCenter(crop, next);
		}
		else {
			pendingCenterRef.current = {crop, zoom: next};

			setZoom(next);
		}

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
							dispatch={dispatch}
							image={image}
							onAnnounce={announce}
							onCenterCrop={centerCrop}
							onSelectOverlay={setSelectedOverlayId}
							onZoom={zoomBy}
							onZoomFit={zoomToFit}
							selectedOverlayId={selectedOverlayId}
							state={state}
							workspaceRef={handleWorkspaceRef}
							zoom={zoom}
						/>

						<aside
							aria-label={t('edit-controls')}
							className="editor-sidebar"
						>
							<CropPanel
								crop={state.crop}
								dispatch={dispatch}
								onAnnounce={announce}
							/>

							<AdjustPanel
								adjustments={state.adjustments}
								dispatch={dispatch}
								onAnnounce={announce}
							/>

							<FilterGallery
								dispatch={dispatch}
								filter={state.filter}
								image={image}
								onAnnounce={announce}
							/>

							<AnnotatePanel
								bounds={rotatedSize(state)}
								dispatch={dispatch}
								onAnnounce={announce}
							/>

							<LayersPanel
								dispatch={dispatch}
								onAnnounce={announce}
								onSelect={setSelectedOverlayId}
								overlays={state.overlays}
								selectedId={selectedOverlayId}
							/>
						</aside>
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
						saving={saving}
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
