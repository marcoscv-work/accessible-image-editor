/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton from '@clayui/button';
import ClayForm, {ClayInput, ClaySelectWithOption} from '@clayui/form';
import ClayModal, {useModal} from '@clayui/modal';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {nextId} from '../state/ids';
import {TextOverlay} from '../state/types';
import {FONT_FAMILIES} from '../textFonts';

interface TextDialogProps {
	onAdd: (overlay: Omit<TextOverlay, 'x' | 'y'>) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function TextDialog({onAdd, onOpenChange, open}: TextDialogProps) {
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
			{/*
			  * The shield keeps the editor's own shortcuts, undo above
			  * all, from reaching it while this dialog is up. Escape is
			  * let through on purpose: Clay's modal hook closes whichever
			  * dialog is on top of its stack, and a synthetic
			  * stopPropagation would stop the native event it listens for.
			  */}
			<div
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key !== 'Escape') {
						event.stopPropagation();
					}
				}}
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
								options={FONT_FAMILIES.map(
									({labelKey, value}) => ({
										label: t(labelKey),
										value,
									})
								)}
								value={fontFamily}
							/>
						</ClayForm.Group>

						{/*
						  * Size and colour on one line: a colour swatch on
						  * a line of its own leaves the dialog looking
						  * unfinished, and the two belong to the same
						  * decision about how the text will look.
						  */}
						<ClayForm.Group>
							<label htmlFor="text-font-size">
								{t('font-size')}
							</label>

							<ClayInput.Group>
								<ClayInput.GroupItem prepend>
									<ClayInput
										id="text-font-size"
										min={8}
										onChange={(event) =>
											setFontSize(event.target.value)
										}
										type="number"
										value={fontSize}
									/>
								</ClayInput.GroupItem>

								<ClayInput.GroupItem append shrink>
									<input
										aria-label={t('text-color')}
										className="editor-color-input form-control"
										id="text-color"
										onChange={(event) =>
											setColor(event.target.value)
										}
										type="color"
										value={color}
									/>
								</ClayInput.GroupItem>
							</ClayInput.Group>
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
