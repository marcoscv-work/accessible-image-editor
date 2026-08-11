import ClayButton from '@clayui/button';
import ClayForm, {ClayInput, ClaySelectWithOption} from '@clayui/form';
import ClayModal, {useModal} from '@clayui/modal';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {
	STICKER_DEFAULT_COLORS,
	STICKER_KINDS,
	StickerArt,
} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {StickerKind, TextOverlay} from '../state/types';

function nextId(kind: string): string {
	return `${kind}-${crypto.randomUUID().slice(0, 8)}`;
}

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

			(node as unknown as HTMLElement | null)?.focus?.();
		});
	}, delay);
}

interface TextDialogProps {
	onAdd: (overlay: Omit<TextOverlay, 'x' | 'y'>) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function TextDialog({onAdd, onOpenChange, open}: TextDialogProps) {
	const {observer} = useModal({onClose: () => onOpenChange(false)});

	const [text, setText] = useState('');
	const [fontFamily, setFontFamily] = useState('sans-serif');
	const [fontSize, setFontSize] = useState('64');
	const [color, setColor] = useState('#ffffff');

	const inputRef = useRef<HTMLInputElement>(null);

	// Clay focuses the modal container after its opening transition, which
	// defeats a plain autoFocus; move focus to the first field once Clay
	// is done.

	useEffect(() => {
		if (!open) {
			return;
		}

		const id = window.setTimeout(() => {
			const active = document.activeElement;

			if (
				!active ||
				active === document.body ||
				active.classList.contains('modal-content')
			) {
				inputRef.current?.focus();
			}
		}, 350);

		return () => window.clearTimeout(id);
	}, [open]);

	if (!open) {
		return null;
	}

	const submit = (event: React.FormEvent) => {
		event.preventDefault();

		if (!text.trim()) {
			return;
		}

		onAdd({
			color,
			fontFamily,
			fontSize: Math.max(Number.parseInt(fontSize, 10) || 64, 8),
			id: nextId('text'),
			kind: 'text',
			text: text.trim(),
		});

		onOpenChange(false);
	};

	return (
		<ClayModal observer={observer} size="sm">
			<div
				onKeyDown={(event: React.KeyboardEvent) =>
					event.stopPropagation()
				}
			>
				<ClayModal.Header closeButtonAriaLabel={t('close')} withTitle>
					{t('add-text')}
				</ClayModal.Header>

				<ClayModal.Body>
					<form onSubmit={submit}>
						<ClayForm.Group>
							<label htmlFor="text-content">
								{t('text-content')}
							</label>

							<ClayInput
								id="text-content"
								onChange={(event) =>
									setText(event.target.value)
								}
								ref={inputRef}
								type="text"
								value={text}
							/>
						</ClayForm.Group>

						<ClayForm.Group>
							<label htmlFor="text-font-family">
								{t('font-family')}
							</label>

							<ClaySelectWithOption
								id="text-font-family"
								onChange={(event) =>
									setFontFamily(event.target.value)
								}
								options={[
									{
										label: t('font-sans-serif'),
										value: 'sans-serif',
									},
									{label: t('font-serif'), value: 'serif'},
								]}
								value={fontFamily}
							/>
						</ClayForm.Group>

						<ClayForm.Group>
							<label htmlFor="text-font-size">
								{t('font-size')}
							</label>

							<ClayInput
								id="text-font-size"
								min={8}
								onChange={(event) =>
									setFontSize(event.target.value)
								}
								type="number"
								value={fontSize}
							/>
						</ClayForm.Group>

						<ClayForm.Group>
							<label htmlFor="text-color">
								{t('text-color')}
							</label>

							<input
								className="editor-color-input form-control"
								id="text-color"
								onChange={(event) =>
									setColor(event.target.value)
								}
								type="color"
								value={color}
							/>
						</ClayForm.Group>

						<ClayButton
							disabled={!text.trim()}
							displayType="primary"
							type="submit"
						>
							{t('add')}
						</ClayButton>
					</form>
				</ClayModal.Body>
			</div>
		</ClayModal>
	);
}

interface Props {
	bounds: {height: number; width: number};
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
}

/**
 * The accessible annotation route: parametric text, shapes, and stickers
 * added through regular form controls, never through freehand pointer
 * drawing.
 */
export function AnnotatePanel({bounds, dispatch, onAnnounce}: Props) {
	const [textDialogOpen, setTextDialogOpen] = useState(false);

	const centerX = Math.round(bounds.width / 2);
	const centerY = Math.round(bounds.height / 2);

	const addRectangle = () => {
		const id = nextId('shape');

		dispatch({
			overlay: {
				color: '#0b5fff',
				height: Math.round(bounds.height * 0.15),
				id,
				kind: 'shape',
				width: Math.round(bounds.width * 0.25),
				x: Math.round(centerX - bounds.width * 0.125),
				y: Math.round(centerY - bounds.height * 0.075),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-shape-label')));

		focusOverlay(id);
	};

	const addSticker = (sticker: StickerKind) => {
		const id = nextId('sticker');

		dispatch({
			overlay: {
				color: STICKER_DEFAULT_COLORS[sticker],
				id,
				kind: 'sticker',
				size: Math.round(Math.min(bounds.width, bounds.height) * 0.2),
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
		<section
			aria-labelledby="annotate-panel-title"
			className="editor-panel"
		>
			<h2 className="editor-panel-title" id="annotate-panel-title">
				{t('annotate')}
			</h2>

			<div className="editor-annotate-actions">
				<ClayButton
					displayType="secondary"
					onClick={() => setTextDialogOpen(true)}
					size="sm"
				>
					{t('add-text')}
				</ClayButton>

				<ClayButton
					displayType="secondary"
					onClick={addRectangle}
					size="sm"
				>
					{t('add-rectangle')}
				</ClayButton>
			</div>

			<div
				aria-label={t('stickers')}
				className="editor-sticker-picker"
				role="group"
			>
				{STICKER_KINDS.map((sticker) => (
					<ClayButton
						aria-label={t(`add-sticker-${sticker}`)}
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
			</div>

			<TextDialog
				onAdd={(overlay) => {
					dispatch({
						overlay: {...overlay, x: centerX, y: centerY},
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
		</section>
	);
}
