import ClayButton from '@clayui/button';
import ClayForm, {ClayInput, ClaySelectWithOption} from '@clayui/form';
import ClayModal, {useModal} from '@clayui/modal';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {TextOverlay} from '../state/types';

function nextId(kind: string): string {
	return `${kind}-${crypto.randomUUID().slice(0, 8)}`;
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
		dispatch({
			overlay: {
				color: '#0b5fff',
				height: Math.round(bounds.height * 0.15),
				id: nextId('shape'),
				kind: 'shape',
				width: Math.round(bounds.width * 0.25),
				x: Math.round(centerX - bounds.width * 0.125),
				y: Math.round(centerY - bounds.height * 0.075),
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-shape-label')));
	};

	const addStar = () => {
		dispatch({
			overlay: {
				id: nextId('sticker'),
				kind: 'sticker',
				size: Math.round(Math.min(bounds.width, bounds.height) * 0.2),
				x: centerX,
				y: centerY,
			},
			type: 'add-overlay',
		});

		onAnnounce(t('annotation-added', t('overlay-sticker-label')));
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

				<ClayButton
					displayType="secondary"
					onClick={addStar}
					size="sm"
				>
					{t('add-star')}
				</ClayButton>
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
				}}
				onOpenChange={setTextDialogOpen}
				open={textDialogOpen}
			/>
		</section>
	);
}
