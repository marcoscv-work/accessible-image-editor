/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React from 'react';

import {ResolvedEditorConfig} from '../editorConfig';
import {t} from '../i18n';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {EditState} from '../state/types';
import {AdjustPanel} from './AdjustPanel';
import {AnnotatePanel} from './AnnotatePanel';
import {CropPanel} from './CropPanel';
import {FilterGallery} from './FilterGallery';
import {FramePanel} from './FramePanel';
import {LayersPanel} from './LayersPanel';

interface Props {
	dispatch: (action: EditorAction) => void;

	/**
	 * What the host asked for, already resolved into plain lists: a panel
	 * renders when its list is not empty.
	 */
	enabled: ResolvedEditorConfig;

	image: LoadedImage;
	onAnnounce: (message: string) => void;
	onSelectOverlay: (id: string | null) => void;
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
	dispatch,
	enabled,
	image,
	onAnnounce,
	onSelectOverlay,
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
				crop={state.crop}
				dispatch={dispatch}
				onAnnounce={onAnnounce}
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
					stickers={enabled.annotate.stickers}
					tools={enabled.annotate.tools}
				/>

				<LayersPanel
					dispatch={dispatch}
					onAnnounce={onAnnounce}
					onSelect={onSelectOverlay}
					overlays={state.overlays}
					selectedId={selectedOverlayId}
				/>
			</>
		)}
	</aside>
	);
}
