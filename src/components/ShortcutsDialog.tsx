/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayModal, {useModal} from '@clayui/modal';
import React from 'react';

import {t} from '../i18n';

const SHORTCUTS: Array<{descriptionKey: string; keys: string}> = [
	{descriptionKey: 'shortcut-arrows', keys: 'Arrow keys'},
	{descriptionKey: 'shortcut-shift-arrows', keys: 'Shift + Arrow keys'},
	{descriptionKey: 'shortcut-shift-drag', keys: 'Shift + drag'},
	{descriptionKey: 'shortcut-alt-drag', keys: 'Alt + drag'},
	{descriptionKey: 'shortcut-zoom', keys: '+ / -'},
	{descriptionKey: 'shortcut-zoom-fit', keys: '0'},
	{descriptionKey: 'shortcut-zoom-actual', keys: '1'},
	{descriptionKey: 'shortcut-center-crop', keys: '2'},
	{descriptionKey: 'shortcut-undo', keys: 'Ctrl/Cmd + Z'},
	{descriptionKey: 'shortcut-redo', keys: 'Ctrl/Cmd + Shift + Z'},
	{descriptionKey: 'shortcut-escape', keys: 'Esc'},
];

interface Props {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function ShortcutsDialog({onOpenChange, open}: Props) {
	const {observer} = useModal({onClose: () => onOpenChange(false)});

	if (!open) {
		return null;
	}

	return (
		<ClayModal observer={observer}>
			{/*
			  * The wrapper keeps the editor's shortcuts, undo above all,
			  * from reaching the editor behind this dialog. React's
			  * stopPropagation also stops the native event, so Escape is
			  * let through on purpose: Clay's own modal hook closes
			  * whichever dialog is on top of its stack, which is this one,
			  * and leaves the editor alone.
			  */}
			<div
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key !== 'Escape') {
						event.stopPropagation();
					}
				}}
			>
				<ClayModal.Header
					closeButtonAriaLabel={t('close')}
					withTitle
				>
					{t('keyboard-shortcuts')}
				</ClayModal.Header>

				<ClayModal.Body>
					<dl className="editor-shortcut-list small">
						{SHORTCUTS.map(({descriptionKey, keys}) => (
							<React.Fragment key={descriptionKey}>
								<dt>
									<kbd>{keys}</kbd>
								</dt>

								<dd>{t(descriptionKey)}</dd>
							</React.Fragment>
						))}
					</dl>
				</ClayModal.Body>
			</div>
		</ClayModal>
	);
}
