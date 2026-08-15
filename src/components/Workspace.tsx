/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React from 'react';

import {t} from '../i18n';
import {FilterDefs, isIdentityFilter} from '../imaging/FilterDefs';
import {FrameShape} from '../imaging/frameShapes';
import {imageTransform} from '../imaging/geometry';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {EditState, rotatedSize} from '../state/types';
import {CropMarquee} from './CropMarquee';
import {OverlaysEditable} from './OverlaysEditable';

interface Props {
	dispatch: (action: EditorAction) => void;
	image: LoadedImage;
	onAnnounce: (message: string) => void;
	onCenterCrop: () => void;
	onSelectOverlay: (id: string | null) => void;
	onWorkspacePointerLeave?: () => void;
	onWorkspacePointerMove?: (event: React.PointerEvent) => void;
	onWorkspaceScroll: () => void;
	onZoom: (direction: -1 | 1) => void;
	onZoomFit: () => void;
	selectedOverlayId: string | null;
	showCrop: boolean;
	showRecenter: boolean;
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
	onCenterCrop,
	onSelectOverlay,
	onWorkspacePointerLeave,
	onWorkspacePointerMove,
	onWorkspaceScroll,
	onZoom,
	onZoomFit,
	selectedOverlayId,
	showCrop,
	showRecenter,
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
						'.overlay-hit, .object-handles, .overlay-text-editor'
					)
				) {
					onSelectOverlay(null);
				}
			}}
			onPointerLeave={onWorkspacePointerLeave}
			onPointerMove={onWorkspacePointerMove}
			onScroll={onWorkspaceScroll}
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
					{/*
					  * A straighten angle scales the image up, so it
					  * spills past the stage: clip it to the image area
					  * to keep the surrounding padding clean.
					  */}
					<clipPath id="stage-clip">
						<rect
							height={bounds.height}
							width={bounds.width}
							x={0}
							y={0}
						/>
					</clipPath>

					<FilterDefs
						adjustments={state.adjustments}
						filter={state.filter}
						id="preview-filter"
					/>
				</defs>

				<g
					clipPath={

						// Only needed while straightening, and clipping a
						// filtered 20MP-derived bitmap is not free.

						state.angle ? 'url(#stage-clip)' : undefined
					}
				>
					<g transform={imageTransform(state)}>
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
				</g>

				<CropMarquee
					bounds={bounds}
					crop={crop}
					dispatch={dispatch}
					onAnnounce={onAnnounce}
					onCenterCrop={onCenterCrop}
					showCrop={showCrop}
					showRecenter={showRecenter}
					zoom={zoom}
				>
					{/*
					  * Under the annotations when asked: a mat that covers
					  * the caption written along the bottom edge is a real
					  * outcome, and which one is wanted is the user's call.
					  */}
					{!state.frame.overAnnotations && (
						<FrameShape crop={crop} frame={state.frame} />
					)}

					<OverlaysEditable
						dispatch={dispatch}
						onAnnounce={onAnnounce}
						onSelect={onSelectOverlay}
						overlays={state.overlays}
						redactSource={{
							filter: isIdentityFilter(
								state.adjustments,
								state.filter
							)
								? undefined
								: 'url(#preview-filter)',
							pixelUrls: image.pixelUrls,
							sourceHeight: state.sourceHeight,
							sourceWidth: state.sourceWidth,
							transform: imageTransform(state),
						}}
						selectedId={selectedOverlayId}
						zoom={zoom}
					/>

					{/*
					  * Above the marquee is never right: the marquee is
					  * chrome, the frame is picture.
					  */}
					{state.frame.overAnnotations && (
						<FrameShape crop={crop} frame={state.frame} />
					)}
				</CropMarquee>
			</svg>
		</div>
	);
}
