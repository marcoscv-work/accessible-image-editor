/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import '../css/Annotations.css';

import ClayButton from '@clayui/button';
import ClayDropDown from '@clayui/drop-down';
import ClayIcon from '@clayui/icon';
import React, {useRef, useState} from 'react';

import {EditorSection} from '../chrome/EditorSection';
import {useEditorId, useEditorRoot} from '../chrome/instance';
import {EmojiPicker} from './EmojiPicker';
import {
	AnnotateTool,
	SHAPE_TOOLS,
	ShapeTool,
	isShapeTool,
} from '../editorConfig';
import {t} from '../i18n';
import {loadOverlayImage} from '../imaging/loadImage';
import {textWidth} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {nextId} from '../state/ids';
import {CropRect, Overlay} from '../state/types';
import {MenuGrid} from './MenuGrid';
import {TextDialog} from './TextDialog';

/**
 * Move focus to the freshly inserted overlay on the stage, so the user
 * can adjust it immediately. The delay matters for the text dialog flow:
 * Clay restores focus to the trigger button when the modal closes, and
 * this focus must land after that.
 */
function focusOverlay(root: () => ParentNode, id: string, delay = 0): void {
	window.setTimeout(() => {
		window.requestAnimationFrame(() => {

			// Resolved through this editor's root at fire time, so two
			// mounted editors can never trade focus.

			const node = root().querySelector<SVGElement>(
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

/**
 * A tool tile: Clay's icon over a one-word label, because a row of five
 * text buttons reads as a wall. The accessible name stays the full verb
 * phrase, which also keeps the visible word inside it (WCAG 2.5.3).
 */
function ToolTile({
	icon,
	label,
	menu,
}: {
	icon: string;
	label: string;

	/**
	 * Whether the tile opens a menu rather than acting at once: it earns
	 * a small caret on its trailing edge. Decoration only, since the
	 * trigger already carries `aria-expanded` for anyone not looking.
	 */
	menu?: boolean;
}) {
	return (
		<>
			<ClayIcon aria-hidden="true" symbol={icon} />

			<span className="editor-tool-tile-label">{label}</span>

			{menu && (
				<ClayIcon
					aria-hidden="true"
					className="editor-tool-tile-caret"
					symbol="angle-down-small"
				/>
			)}
		</>
	);
}

/**
 * The drawing a shape cell holds. It is the whole cell rather than a
 * marker in front of a word, so it is hidden from assistive technology
 * and the cell's own label is what names it.
 */
function ShapePreview({shape}: {shape: ShapeTool}) {
	return (
		<svg
			aria-hidden="true"
			className="editor-menu-preview"
			focusable="false"
			height={22}
			viewBox="0 0 16 16"
			width={22}
		>
			{shape === 'rectangle' && (
				<rect fill="currentColor" height={8} width={14} x={1} y={4} />
			)}

			{shape === 'square' && (
				<rect fill="currentColor" height={12} width={12} x={2} y={2} />
			)}

			{shape === 'circle' && (
				<circle cx={8} cy={8} fill="currentColor" r={6} />
			)}

			{shape === 'arrow' && (
				<>
					<line
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth={2}
						x1={2}
						x2={10}
						y1={8}
						y2={8}
					/>

					<polygon fill="currentColor" points="15,8 9,11 9,5" />
				</>
			)}
		</svg>
	);
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
	 * Enters drawing mode on the stage: the pen and the freehand gesture
	 * live there, not in this panel. The argument says what pressed the
	 * button, because a keyboard entry runs the guided line instead of
	 * the free pen.
	 */
	onStartDrawing: (via: 'keyboard' | 'pointer') => void;

	/**
	 * Which annotation tools to offer.
	 */
	tools: AnnotateTool[];
}

/**
 * The accessible annotation route: parametric text, shapes, strokes and
 * emoji added through regular form controls. The freehand gesture exists,
 * but as one route into the same parametric stroke the pen reaches
 * without dragging, never as ink of its own.
 */
export function AnnotatePanel({
	area,
	dispatch,
	onAnnounce,
	onStartDrawing,
	tools,
}: Props) {
	const eid = useEditorId();

	const editorRoot = useEditorRoot();

	const [textDialogOpen, setTextDialogOpen] = useState(false);

	const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

	const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);

	/**
	 * Roving tabindex (APG): the whole Annotate panel is one tab stop;
	 * the left and right arrows move between the buttons, and Tab
	 * re-enters at the last used control.
	 */
	const [rovingIndex, setRovingIndex] = useState(0);

	const panelRef = useRef<HTMLDivElement>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// The drawn shapes share one menu, so the panel's controls are not the
	// tool list: they are the tools that are not shapes, plus the menu
	// standing in for those that are.

	const shapeTools = tools.filter(isShapeTool);

	const controls: string[] = [
		...(tools.includes('text') ? ['text'] : []),
		...(shapeTools.length ? ['shapes'] : []),
		...(tools.includes('draw') ? ['draw'] : []),
		...(tools.includes('redaction') ? ['redaction'] : []),
		...(tools.includes('image') ? ['image'] : []),
		...(tools.includes('emoji') ? ['emoji'] : []),
	];

	const indexOf = (control: string) => controls.indexOf(control);

	const handlePanelKeyDown = (event: React.KeyboardEvent) => {
		const origin = (event.target as Element).closest('[data-index]');

		if (!origin) {
			return;
		}

		// On a menu button the vertical arrows belong to the menu, which
		// opens on Down and moves through its own entries from there. The
		// horizontal pair still walks the panel, which is the toolbar
		// behaviour these buttons share with every other control here.

		const isMenu = origin.hasAttribute('data-menu-trigger');

		let index = Number(origin.getAttribute('data-index'));

		switch (event.key) {
			case 'ArrowDown':
				if (isMenu) {
					return;
				}

				index = Math.min(index + 1, controls.length - 1);
				break;

			case 'ArrowRight':
				index = Math.min(index + 1, controls.length - 1);
				break;

			case 'ArrowUp':
				if (isMenu) {
					return;
				}

				index = Math.max(index - 1, 0);
				break;

			case 'ArrowLeft':
				index = Math.max(index - 1, 0);
				break;

			case 'End':
				index = controls.length - 1;
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

	const rovingProps = (index: number) => ({
		'data-index': index,
		onFocus: () => setRovingIndex(index),
		tabIndex: rovingIndex === index ? 0 : -1,
	});

	const centerX = Math.round(area.x + area.width / 2);
	const centerY = Math.round(area.y + area.height / 2);

	const add = (overlay: Overlay, label: string) => {
		dispatch({overlay, type: 'add-overlay'});

		onAnnounce(t('x-added-to-the-center-of-the-crop-area', label));

		focusOverlay(editorRoot, overlay.id);
	};

	const addRectangle = () =>
		add(
			{
				color: '#0b5fff',
				height: Math.round(area.height * 0.15),
				id: nextId('shape'),
				kind: 'shape',
				width: Math.round(area.width * 0.25),
				x: Math.round(centerX - area.width * 0.125),
				y: Math.round(centerY - area.height * 0.075),
			},
			t('overlay-shape-label')
		);

	const addSquare = () => {
		const size = Math.round(Math.min(area.width, area.height) * 0.2);

		add(
			{
				color: '#0b5fff',
				height: size,
				id: nextId('shape'),
				kind: 'shape',
				width: size,
				x: Math.round(centerX - size / 2),
				y: Math.round(centerY - size / 2),
			},
			t('overlay-shape-label')
		);
	};

	const addCircle = () => {
		const size = Math.round(Math.min(area.width, area.height) * 0.2);

		add(
			{
				color: '#0b5fff',
				height: size,
				id: nextId('circle'),
				kind: 'circle',
				width: size,
				x: Math.round(centerX - size / 2),
				y: Math.round(centerY - size / 2),
			},
			t('circle')
		);
	};

	const addArrow = () => {
		const length = Math.round(Math.min(area.width, area.height) * 0.3);

		add(
			{
				color: '#0b5fff',

				// Horizontal and pointing right, which is the arrow nobody
				// has to reinterpret. Both ends move afterwards.

				dx: length,
				dy: 0,
				head: 'filled',
				id: nextId('arrow'),
				kind: 'arrow',
				thickness: Math.max(
					2,
					Math.round(Math.min(area.width, area.height) * 0.012)
				),
				x: Math.round(centerX - length / 2),
				y: centerY,
			},
			t('overlay-arrow-label')
		);
	};

	const ADD_SHAPE: Record<ShapeTool, () => void> = {
		arrow: addArrow,
		circle: addCircle,
		rectangle: addRectangle,
		square: addSquare,
	};

	const addRedaction = () =>
		add(
			{
				height: Math.round(area.height * 0.15),
				id: nextId('redact'),
				kind: 'redact',

				// Small blocks by default: coarse enough to hide, fine
				// enough to keep the frame readable.

				level: 'fine',
				width: Math.round(area.width * 0.25),
				x: Math.round(centerX - area.width * 0.125),
				y: Math.round(centerY - area.height * 0.075),
			},
			t('overlay-redact-label')
		);

	const addImage = async (file: File) => {
		let picture;

		try {
			picture = await loadOverlayImage(file);
		}
		catch {
			onAnnounce(t('image-annotation-failed'));

			return;
		}

		// A third of the crop, in the picture's own proportions and never
		// taller than the crop: a phone screenshot dropped on a landscape
		// photograph should land as an annotation, not as a curtain.

		const width = Math.min(
			Math.round(area.width / 3),
			Math.round(((area.height / 3) * picture.width) / picture.height)
		);

		const height = Math.round((width * picture.height) / picture.width);

		add(
			{
				description: file.name.replace(/\.[^.]+$/, ''),
				height,
				id: nextId('image'),
				kind: 'image',
				src: picture.src,
				width,
				x: Math.round(centerX - width / 2),
				y: Math.round(centerY - height / 2),
			},
			t('image')
		);
	};

	const addEmoji = (character: string, name: string) =>
		add(
			{
				character,
				id: nextId('emoji'),
				kind: 'emoji',
				name,
				size: Math.round(Math.min(area.width, area.height) * 0.2),
				x: centerX,
				y: centerY,
			},
			name
		);

	return (
		<EditorSection title={t('annotate')} titleId={eid('annotate-panel-title')}>
			<div
				className="editor-annotate-actions"
				onKeyDown={handlePanelKeyDown}
				ref={panelRef}
			>
				{tools.includes('text') && (
					<ClayButton
						{...rovingProps(indexOf('text'))}
						aria-label={t('add-text')}
						className="editor-tool-tile"
						displayType="secondary"
						onClick={() => setTextDialogOpen(true)}
					>
						<ToolTile icon="text" label={t('text')} />
					</ClayButton>
				)}

				{shapeTools.length > 0 && (
					<ClayDropDown
						active={shapeMenuOpen}
						menuElementAttrs={{className: 'editor-menu-popover'}}
						onActiveChange={setShapeMenuOpen}
						trigger={
							<ClayButton
								{...rovingProps(indexOf('shapes'))}
								aria-label={t('add-shape')}
								className="editor-tool-tile"
								data-menu-trigger
								displayType="secondary"
							>
								<ToolTile
									icon="squares"
									label={t('tool-shape')}
									menu
								/>
							</ClayButton>
						}
					>
						<MenuGrid
							choices={SHAPE_TOOLS.filter((shape) =>
								shapeTools.includes(shape)
							).map((shape) => ({
								art: <ShapePreview shape={shape} />,
								id: shape,
								label: t(`shape-${shape}`),
							}))}
							columns={4}
							label={t('add-shape')}
							onChoose={(shape) => {
								setShapeMenuOpen(false);

								ADD_SHAPE[shape as ShapeTool]();
							}}
						/>
					</ClayDropDown>
				)}

				{tools.includes('draw') && (
					<ClayButton
						{...rovingProps(indexOf('draw'))}
						aria-label={t('add-draw')}
						className="editor-tool-tile"
						displayType="secondary"
						onClick={(event: React.MouseEvent) =>

							// A click a keyboard produced reports no
							// detail: that is the browser's own record of
							// how the button was pressed.

							onStartDrawing(
								event.detail === 0 ? 'keyboard' : 'pointer'
							)
						}
					>
						<ToolTile icon="pencil" label={t('tool-draw')} />
					</ClayButton>
				)}

				{tools.includes('redaction') && (
					<ClayButton
						{...rovingProps(indexOf('redaction'))}
						aria-label={t('add-redaction')}
						className="editor-tool-tile"
						displayType="secondary"
						onClick={addRedaction}
					>
						<ToolTile icon="hidden" label={t('tool-redact')} />
					</ClayButton>
				)}

				{tools.includes('image') && (
					<>
						<ClayButton
							{...rovingProps(indexOf('image'))}
							aria-label={t('add-image')}
							className="editor-tool-tile"
							displayType="secondary"
							onClick={() => fileInputRef.current?.click()}
						>
							<ToolTile
								icon="picture"
								label={t('image')}
							/>
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

				{tools.includes('emoji') && (
					<ClayDropDown
					active={emojiMenuOpen}
					menuElementAttrs={{
						className: 'editor-emoji-popover editor-menu-popover',
					}}
					onActiveChange={setEmojiMenuOpen}
					trigger={
						<ClayButton
							{...rovingProps(indexOf('emoji'))}
							aria-label={t('add-emoji')}
							className="editor-tool-tile"
							data-menu-trigger
							displayType="secondary"
						>
							<ToolTile
								icon="emoji"
								label={t('tool-emoji')}
								menu
							/>
						</ClayButton>
					}
				>
					{emojiMenuOpen && (
						<EmojiPicker
							onChoose={(entry) => {
								setEmojiMenuOpen(false);

								addEmoji(entry.c, entry.n);
							}}
						/>
					)}
				</ClayDropDown>
				)}
			</div>

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
						t(
							'x-added-to-the-center-of-the-crop-area',
							t('overlay-text-label', overlay.text)
						)
					);

					focusOverlay(editorRoot, overlay.id, 450);
				}}
				onOpenChange={setTextDialogOpen}
				open={textDialogOpen}
			/>
		</EditorSection>
	);
}
