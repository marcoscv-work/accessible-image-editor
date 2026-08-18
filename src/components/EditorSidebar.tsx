/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React from 'react';

import {ResolvedEditorConfig} from '../editorConfig';
import {t} from '../i18n';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {EditState, rotatedSize} from '../state/types';
import {AdjustPanel} from './AdjustPanel';
import {AnnotatePanel} from './AnnotatePanel';
import {CropPanel} from './CropPanel';
import {FilterGallery} from './FilterGallery';
import {FramePanel} from './FramePanel';
import {LayersPanel} from './LayersPanel';

interface Props {

	/**
	 * Whether the crop keeps its proportions, which the panel offers and
	 * the stage obeys.
	 */
	aspectLocked: boolean;

	dispatch: (action: EditorAction) => void;

	/**
	 * What the host asked for, already resolved into plain lists: a panel
	 * renders when its list is not empty.
	 */
	enabled: ResolvedEditorConfig;

	image: LoadedImage;
	onAnnounce: (message: string) => void;
	onAspectLockedChange: (locked: boolean) => void;
	onProportionalChange: (proportional: boolean) => void;
	onSelectOverlay: (id: string | null) => void;

	/**
	 * Enters drawing mode on the stage; the argument says what pressed
	 * the button.
	 */
	onStartDrawing: (via: 'keyboard' | 'pointer') => void;


	/**
	 * Whether the selected annotation keeps its proportions.
	 */
	proportional: boolean;

	selectedOverlayId: string | null;
	sidebarRef: React.Ref<HTMLElement>;
	state: EditState;
}

/**
 * The controls beside the stage, in the order the work is usually done:
 * frame the picture, correct its tone, give it a look, put an edge on it,
 * and mark it up. Each panel is a disclosure that can be switched off
 * entirely through the configuration, and this is the only place that
 * decides which ones exist.
 */
export function EditorSidebar({
	aspectLocked,
	dispatch,
	enabled,
	image,
	onAnnounce,
	onAspectLockedChange,
	onProportionalChange,
	onSelectOverlay,
	onStartDrawing,
	proportional,
	selectedOverlayId,
	sidebarRef,
	state,
}: Props) {
	return (
	<aside
		aria-label={t('edit-controls')}
		className="editor-sidebar"
		ref={sidebarRef}
	>
		{enabled.crop.enabled && (
			<CropPanel
				angle={state.angle}
				aspectLocked={aspectLocked}
				bounds={rotatedSize(state)}
				crop={state.crop}
				dispatch={dispatch}
				onAnnounce={onAnnounce}
				onAspectLockedChange={onAspectLockedChange}
				showStraighten={enabled.crop.straighten}
			/>
		)}

		{enabled.adjustments.length > 0 && (
			<AdjustPanel
				adjustments={state.adjustments}
				dispatch={dispatch}
				onAnnounce={onAnnounce}
				sliders={enabled.adjustments}
			/>
		)}

		{enabled.filters.length > 0 && (
			<FilterGallery
				dispatch={dispatch}
				filter={state.filter}
				image={image}
				onAnnounce={onAnnounce}
				presets={enabled.filters}
			/>
		)}

		{enabled.frames.length > 0 && (
			<FramePanel
				dispatch={dispatch}
				frame={state.frame}
				image={image}
				onAnnounce={onAnnounce}
				presets={enabled.frames}
			/>
		)}

		{enabled.annotate.tools.length > 0 && (
			<>
				<AnnotatePanel
					area={state.crop}
					dispatch={dispatch}
					onAnnounce={onAnnounce}
					onStartDrawing={onStartDrawing}
					tools={enabled.annotate.tools}
				/>

				<LayersPanel
					dispatch={dispatch}
					onAnnounce={onAnnounce}
					onProportionalChange={onProportionalChange}
					onSelect={onSelectOverlay}
					overlays={state.overlays}
					proportional={proportional}
					selectedId={selectedOverlayId}
				/>
			</>
		)}
	</aside>
	);
}
