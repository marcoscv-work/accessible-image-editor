import ClayButton from '@clayui/button';
import ClayModal, {useModal} from '@clayui/modal';
import React, {useEffect, useReducer, useState} from 'react';

import {t} from '../i18n';
import {downloadBlob, exportEditedImage} from '../imaging/exportImage';
import {LoadedImage} from '../imaging/loadImage';
import {
	editorReducer,
	initialHistory,
	redoLabel,
	undoLabel,
} from '../state/editorReducer';
import {rotatedSize} from '../state/types';
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

function fitZoom(width: number, height: number): number {
	const availableWidth = Math.max(window.innerWidth - 360, 240);
	const availableHeight = Math.max(window.innerHeight - 200, 240);

	const fit = Math.min(availableWidth / width, availableHeight / height, 1);

	return Math.max(Math.round(fit * 100) / 100, 0.01);
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

	const [zoom, setZoom] = useState(() => fitZoom(image.width, image.height));
	const [saving, setSaving] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	const state = history.present;

	useEffect(() => {
		announce(t('editor-loaded', image.width, image.height));
	}, [announce, image]);

	const zoomBy = (direction: -1 | 1) => {
		const next = stepZoom(zoom, direction);

		if (next !== zoom) {
			setZoom(next);
			announce(t('zoom-level', Math.round(next * 100)));
		}
	};

	const zoomToFit = () => {
		const bounds = rotatedSize(state);

		const next = fitZoom(bounds.width, bounds.height);

		setZoom(next);
		announce(t('zoom-level', Math.round(next * 100)));
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
							onZoom={zoomBy}
							onZoomFit={zoomToFit}
							state={state}
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
								overlays={state.overlays}
							/>

							<ClayButton
								className="mt-3"
								displayType="secondary"
								onClick={() => setShortcutsOpen(true)}
								size="sm"
							>
								{t('keyboard-shortcuts')}
							</ClayButton>
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
