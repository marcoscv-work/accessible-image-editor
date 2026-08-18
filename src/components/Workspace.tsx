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
import {DrawSurface} from './DrawSurface';
import {OverlaysEditable} from './OverlaysEditable';

interface Props {

	/**
	 * With the crop's proportions locked the marquee offers corners only,
	 * and they keep the ratio.
	 */
	aspectLocked: boolean;

	dispatch: (action: EditorAction) => void;

	/**
	 * Whether the stage is in drawing mode, with the surface capturing
	 * the pen's clicks and the freehand gesture.
	 */
	drawing?: boolean;

	/**
	 * Whether the drawing runs as the guided keyboard line.
	 */
	guidedDrawing?: boolean;

	image: LoadedImage;
	onAnnounce: (message: string) => void;
	onCenterCrop: () => void;

	/**
	 * The editor-internal clipboard: copy is offered on the focused
	 * annotation, paste anywhere in the workspace.
	 */
	onCopyOverlay?: (id: string) => void;

	onFinishDrawing?: (
		result: {points: number[]; smooth: boolean} | null
	) => void;

	onPasteOverlay?: () => void;

	onSelectOverlay: (id: string | null) => void;
	onWorkspacePointerLeave?: () => void;
	onWorkspacePointerMove?: (event: React.PointerEvent) => void;
	onWorkspaceScroll: () => void;
	onZoom: (direction: -1 | 1) => void;
	onZoomActual: () => void;
	onZoomFit: () => void;

	/**
	 * Whether the selected annotation keeps its proportions.
	 */
	proportional: boolean;

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
	aspectLocked,
	dispatch,
	drawing,
	guidedDrawing,
	image,
	onAnnounce,
	onCenterCrop,
	onCopyOverlay,
	onFinishDrawing,
	onPasteOverlay,
	onSelectOverlay,
	onWorkspacePointerLeave,
	onWorkspacePointerMove,
	onWorkspaceScroll,
	onZoom,
	onZoomActual,
	onZoomFit,
	proportional,
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

		// The numbers read as the view menu of any editor: fit, actual
		// size, and then the region being worked on.

		else if (event.key === '1') {
			event.preventDefault();
			onZoomActual();
		}
		else if (event.key === '2') {
			event.preventDefault();
			onCenterCrop();
		}
		else if (
			(event.metaKey || event.ctrlKey) &&
			event.key.toLowerCase() === 'v'
		) {

			// Paste works anywhere in the workspace: the thing pasted
			// carries its own position, so no target is needed.

			event.preventDefault();
			onPasteOverlay?.();
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
					aspectLocked={aspectLocked}
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
						onCopy={onCopyOverlay}
						onSelect={onSelectOverlay}
						overlays={state.overlays}
						proportional={proportional}
						redactSource={{
							filter: isIdentityFilter(
								state.adjustments,
								state.filter
							)
								? undefined
								: 'url(#preview-filter)',
							imageUrl: image.previewUrl,
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

					{/*
					  * The drawing surface rides above everything while it
					  * lasts, because while drawing, drawing is the mode.
					  */}
					{drawing && onFinishDrawing && (
						<DrawSurface
							area={crop}
							color="#0b5fff"
							guided={guidedDrawing}
							onAnnounce={onAnnounce}
							onFinish={onFinishDrawing}
							width={Math.max(
								3,
								Math.round(
									Math.min(crop.width, crop.height) * 0.008
								)
							)}
							zoom={zoom}
						/>
					)}
				</CropMarquee>
			</svg>
		</div>
	);
}
