/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React from 'react';

import {t} from '../i18n';
import {FilterDefs, isIdentityFilter} from '../imaging/FilterDefs';
import {rotationTransform} from '../imaging/geometry';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {EditState, rotatedSize} from '../state/types';
import {CropMarquee} from './CropMarquee';
import {OverlaysEditable} from './OverlaysEditable';

interface Props {
	dispatch: (action: EditorAction) => void;
	image: LoadedImage;
	onAnnounce: (message: string) => void;
	onSelectOverlay: (id: string | null) => void;
	onZoom: (direction: -1 | 1) => void;
	onZoomFit: () => void;
	selectedOverlayId: string | null;
	state: EditState;
	workspaceRef?: React.Ref<HTMLDivElement>;
	zoom: number;
}

/**
 * The editing stage: a scrollable, focusable region containing one SVG that
 * composes the raster image, the color pipeline, and the crop marquee as
 * real DOM. The dim layer outside the crop is drawn with an even-odd path.
 */
export function Workspace({
	dispatch,
	image,
	onAnnounce,
	onSelectOverlay,
	onZoom,
	onZoomFit,
	selectedOverlayId,
	state,
	workspaceRef,
	zoom,
}: Props) {
	const bounds = rotatedSize(state);
	const {crop} = state;

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			onZoom(1);
		}
		else if (event.key === '-' || event.key === '_') {
			event.preventDefault();
			onZoom(-1);
		}
		else if (event.key === '0') {
			event.preventDefault();
			onZoomFit();
		}
	};

	const dimPath =
		`M0 0H${bounds.width}V${bounds.height}H0Z` +
		`M${crop.x} ${crop.y}` +
		`H${crop.x + crop.width}V${crop.y + crop.height}H${crop.x}Z`;

	return (
		<div
			aria-describedby="workspace-description"
			aria-label={t('workspace')}
			className="editor-workspace"
			onKeyDown={handleKeyDown}
			onPointerDown={(event) => {

				// Clicking anything that is not an annotation clears the
				// visual selection, drawing-tool style.

				if (
					!(event.target as Element).closest(
						'.overlay-hit, .object-handles'
					)
				) {
					onSelectOverlay(null);
				}
			}}
			ref={workspaceRef}
			role="region"
			tabIndex={0}
		>
			<span className="sr-only" id="workspace-description">
				{t('workspace-description')}
			</span>

			<svg
				className="editor-stage"
				height={bounds.height * zoom}
				viewBox={`0 0 ${bounds.width} ${bounds.height}`}
				width={bounds.width * zoom}
			>
				<defs>
					<FilterDefs
						adjustments={state.adjustments}
						filter={state.filter}
						id="preview-filter"
					/>
				</defs>

				<g transform={rotationTransform(state)}>
					<image
						filter={
							isIdentityFilter(state.adjustments, state.filter)
								? undefined
								: 'url(#preview-filter)'
						}
						height={state.sourceHeight}
						href={image.previewUrl}
						preserveAspectRatio="none"
						width={state.sourceWidth}
					/>
				</g>

				<path
					className="crop-dim"
					d={dimPath}
					fillRule="evenodd"
					pointerEvents="none"
				/>

				<CropMarquee
					crop={crop}
					dispatch={dispatch}
					onAnnounce={onAnnounce}
					zoom={zoom}
				>
					<OverlaysEditable
						dispatch={dispatch}
						onAnnounce={onAnnounce}
						onSelect={onSelectOverlay}
						overlays={state.overlays}
						selectedId={selectedOverlayId}
						zoom={zoom}
					/>
				</CropMarquee>
			</svg>
		</div>
	);
}
