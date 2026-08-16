/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton from '@clayui/button';
import React, {useRef, useState} from 'react';

import {AnnotateTool} from '../editorConfig';
import {t} from '../i18n';
import {loadOverlayImage} from '../imaging/loadImage';
import {
	STICKER_DEFAULT_COLORS,
	StickerArt,
	textWidth,
} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {nextId} from '../state/ids';
import {CropRect, StickerKind} from '../state/types';
import {Carousel} from './Carousel';
import {EditorSection} from './EditorSection';
import {TextDialog} from './TextDialog';

/**
 * Move focus to the freshly inserted overlay on the stage, so the user
 * can adjust it immediately. The delay matters for the text dialog flow:
 * Clay restores focus to the trigger button when the modal closes, and
 * this focus must land after that.
 */
function focusOverlay(id: string, delay = 0): void {
	window.setTimeout(() => {
		window.requestAnimationFrame(() => {
			const node = document.querySelector<SVGElement>(
				`[data-overlay-id="${id}"]`
			);

			if (!node) {
				return;
			}

			// Focus on its own asks the browser to reveal the element, and
			// the browser reveals it by scrolling every ancestor that can
			// scroll, the dialog included: on a slow first paint, before
			// the stage has been fitted, that walks the whole editor off
			// the screen. Take the scrolling into our own hands and move
			// only the workspace.

			(node as unknown as HTMLElement).focus?.({preventScroll: true});

			revealInWorkspace(node);
		});
	}, delay);
}

/**
 * Scrolls the workspace, and nothing else, until the annotation is inside
 * it.
 */
function revealInWorkspace(node: SVGElement): void {
	const workspace = node.closest<HTMLElement>('.editor-workspace');

	if (!workspace) {
		return;
	}

	const area = workspace.getBoundingClientRect();
	const box = node.getBoundingClientRect();

	const overflow = (start: number, end: number, low: number, high: number) =>
		start < low ? start - low : end > high ? end - high : 0;

	workspace.scrollLeft += overflow(box.left, box.right, area.left, area.right);
	workspace.scrollTop += overflow(box.top, box.bottom, area.top, area.bottom);
}

interface Props {

	/**
	 * The current crop rectangle: new annotations are centered on it and
	 * sized relative to it, so they always land inside what the user is
	 * working on rather than at the center of the whole image.
	 */
	area: CropRect;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;

	/**
	 * Which sticker shapes to offer, in canonical order.
	 */
	stickers: StickerKind[];

	/**
	 * Which annotation tools to offer.
	 */
	tools: AnnotateTool[];
}

/**
 * The accessible annotation route: parametric text, shapes, and stickers
 * added through regular form controls, never through freehand pointer
 * drawing.
 */
export function AnnotatePanel({
	area,
	dispatch,
	onAnnounce,
	stickers,
	tools,
}: Props) {
	const [textDialogOpen, setTextDialogOpen] = useState(false);

	/**
	 * Roving tabindex (APG): the whole Annotate panel is one tab stop;
	 * arrows move between the add buttons and the sticker picker, and
	 * Tab re-enters at the last used control.
	 */
	const [rovingIndex, setRovingIndex] = useState(0);

	const panelRef = useRef<HTMLDivElement>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// The roving order follows what is actually rendered, so a reduced
	// tool set still behaves as one tab stop with contiguous arrows.

	const shownStickers = tools.includes('stickers') ? stickers : [];

	const shownTools = tools.filter((tool) => tool !== 'stickers');

	const controlCount = shownTools.length + shownStickers.length;

	const toolIndex = (tool: AnnotateTool) =>
		shownTools.indexOf(tool as (typeof shownTools)[number]);

	const handlePanelKeyDown = (event: React.KeyboardEvent) => {
		const origin = (event.target as Element).closest('[data-index]');

		if (!origin) {
			return;
		}

		let index = Number(origin.getAttribute('data-index'));

		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				index = Math.min(index + 1, controlCount - 1);
				break;

			case 'ArrowLeft':
			case 'ArrowUp':
				index = Math.max(index - 1, 0);
				break;

			case 'End':
				index = controlCount - 1;
				break;

			case 'Home':
				index = 0;
				break;

			default:
				return;
		}

		event.preventDefault();

		const target = panelRef.current?.querySelector<HTMLButtonElement>(
			`[data-index="${index}"]`
		);

		if (target) {
			setRovingIndex(index);

			target.focus();
		}
	};

	/*
	 * Roving tabindex over the whole panel: the arrows walk the tools and
	 * the stickers as one sequence. Each of the two containers keeps a
	 * tabbable item of its own, though, because in the stacked layout the
	 * sticker picker is a horizontal scroll container, and a scrollable
	 * region holding nothing tabbable cannot be reached at all by someone
	 * arriving with Tab.
	 */

	const rovingProps = (index: number) => {
		const inStickers = index >= shownTools.length;
		const activeInStickers = rovingIndex >= shownTools.length;

		const entryPoint = inStickers ? shownTools.length : 0;

		return {
			'data-index': index,
			onFocus: () => setRovingIndex(index),
			tabIndex:
				rovingIndex === index ||
				(inStickers !== activeInStickers && index === entryPoint)
					? 0
					: -1,
		};
	};

	const centerX = Math.round(area.x + area.width / 2);
	const centerY = Math.round(area.y + area.height / 2);

	const addRectangle = () => {
		const id = nextId('shape');

		dispatch({
			overlay: {
				color: '#0b5fff',
				height: Math.round(area.height * 0.15),
				id,
				kind: 'shape',
				width: Math.round(area.width * 0.25),
				x: Math.round(centerX - area.width * 0.125),
				y: Math.round(centerY - area.height * 0.075),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-shape-label')));

		focusOverlay(id);
	};

	const addCircle = () => {
		const id = nextId('circle');

		const size = Math.round(Math.min(area.width, area.height) * 0.2);

		dispatch({
			overlay: {
				color: '#0b5fff',
				height: size,
				id,
				kind: 'circle',
				width: size,
				x: Math.round(centerX - size / 2),
				y: Math.round(centerY - size / 2),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-circle-label')));

		focusOverlay(id);
	};

	const addRedaction = () => {
		const id = nextId('redact');

		dispatch({
			overlay: {
				height: Math.round(area.height * 0.15),
				id,
				kind: 'redact',

				// Small blocks by default: coarse enough to hide, fine
				// enough to keep the frame readable.

				level: 'fine',
				width: Math.round(area.width * 0.25),
				x: Math.round(centerX - area.width * 0.125),
				y: Math.round(centerY - area.height * 0.075),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-redact-label')));

		focusOverlay(id);
	};

	const addImage = async (file: File) => {
		let picture;

		try {
			picture = await loadOverlayImage(file);
		}
		catch {
			onAnnounce(t('image-annotation-failed'));

			return;
		}

		const id = nextId('image');

		// A third of the crop, in the picture's own proportions and never
		// taller than the crop: a phone screenshot dropped on a landscape
		// photograph should land as an annotation, not as a curtain.

		const width = Math.min(
			Math.round(area.width / 3),
			Math.round(((area.height / 3) * picture.width) / picture.height)
		);

		const height = Math.round((width * picture.height) / picture.width);

		dispatch({
			overlay: {
				description: file.name.replace(/\.[^.]+$/, ''),
				height,
				id,
				kind: 'image',
				src: picture.src,
				width,
				x: Math.round(centerX - width / 2),
				y: Math.round(centerY - height / 2),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-image-label')));

		focusOverlay(id);
	};

	const addSticker = (sticker: StickerKind) => {
		const id = nextId('sticker');

		dispatch({
			overlay: {
				color: STICKER_DEFAULT_COLORS[sticker],
				id,
				kind: 'sticker',
				size: Math.round(Math.min(area.width, area.height) * 0.2),
				sticker,
				x: centerX,
				y: centerY,
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t(`sticker-${sticker}`)));

		focusOverlay(id);
	};

	return (
		<EditorSection title={t('annotate')} titleId="annotate-panel-title">
			<div onKeyDown={handlePanelKeyDown} ref={panelRef}>

			<div className="editor-annotate-actions">
				{tools.includes('text') && (
					<ClayButton
						{...rovingProps(toolIndex('text'))}
						displayType="secondary"
						onClick={() => setTextDialogOpen(true)}
						size="sm"
					>
						{t('add-text')}
					</ClayButton>
				)}

				{tools.includes('rectangle') && (
					<ClayButton
						{...rovingProps(toolIndex('rectangle'))}
						displayType="secondary"
						onClick={addRectangle}
						size="sm"
					>
						{t('add-rectangle')}
					</ClayButton>
				)}

				{tools.includes('circle') && (
					<ClayButton
						{...rovingProps(toolIndex('circle'))}
						displayType="secondary"
						onClick={addCircle}
						size="sm"
					>
						{t('add-circle')}
					</ClayButton>
				)}

				{tools.includes('redaction') && (
					<ClayButton
						{...rovingProps(toolIndex('redaction'))}
						displayType="secondary"
						onClick={addRedaction}
						size="sm"
					>
						{t('add-redaction')}
					</ClayButton>
				)}

				{tools.includes('image') && (
					<>
						<ClayButton
							{...rovingProps(toolIndex('image'))}
							displayType="secondary"
							onClick={() => fileInputRef.current?.click()}
							size="sm"
						>
							{t('add-image')}
						</ClayButton>

						{/*
						  * Hidden rather than visually hidden: the button is
						  * the control, and a reachable input next to it
						  * would be the same action announced twice.
						  */}
						<input
							accept="image/png,image/jpeg,image/webp,image/gif"
							hidden
							onChange={(event) => {
								const file = event.target.files?.[0];

								// Cleared before the await, so picking the
								// same file again still fires a change.

								event.target.value = '';

								if (file) {
									addImage(file);
								}
							}}
							ref={fileInputRef}
							type="file"
						/>
					</>
				)}
			</div>

			{/*
			  * Stacked layout: the stickers would wrap onto three rows, so
			  * they run in one swipeable row instead.
			  */}
			<Carousel
				aria-label={t('stickers')}
				className="editor-sticker-picker"
				itemCount={shownStickers.length}
				role="group"
			>
				{shownStickers.map((sticker, stickerIndex) => (
					<ClayButton
						{...rovingProps(shownTools.length + stickerIndex)}
						aria-label={t(`add-sticker-${sticker}`)}
						className="btn-monospaced"
						displayType="secondary"
						key={sticker}
						onClick={() => addSticker(sticker)}
						size="sm"
						title={t(`add-sticker-${sticker}`)}
					>
						<svg
							aria-hidden="true"
							focusable="false"
							height={20}
							viewBox="0 0 24 24"
							width={20}
						>
							<StickerArt
								color={STICKER_DEFAULT_COLORS[sticker]}
								size={22}
								sticker={sticker}
								x={12}
								y={12}
							/>
						</svg>
					</ClayButton>
				))}
			</Carousel>

			<TextDialog
				onAdd={(overlay) => {
					dispatch({
						overlay: {
							...overlay,
							x:
								centerX -
								textWidth(
									overlay.text,
									overlay.fontFamily,
									overlay.fontSize
								) /
									2,
							y: centerY,
						},
						type: 'add-overlay',
					});

					onAnnounce(
						t('annotation-added', t('overlay-text-label', overlay.text))
					);

					focusOverlay(overlay.id, 450);
				}}
					onOpenChange={setTextDialogOpen}
					open={textDialogOpen}
				/>
			</div>
		</EditorSection>
	);
}
