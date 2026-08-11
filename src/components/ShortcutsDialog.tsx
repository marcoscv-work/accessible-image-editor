import ClayModal, {useModal} from '@clayui/modal';
import React from 'react';

import {t} from '../i18n';

const SHORTCUTS: Array<{descriptionKey: string; keys: string}> = [
	{descriptionKey: 'shortcut-arrows', keys: 'Arrow keys'},
	{descriptionKey: 'shortcut-shift-arrows', keys: 'Shift + Arrow keys'},
	{descriptionKey: 'shortcut-zoom', keys: '+ / -'},
	{descriptionKey: 'shortcut-zoom-fit', keys: '0'},
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
			<div onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()}>
				<ClayModal.Header
					closeButtonAriaLabel={t('close')}
					withTitle
				>
					{t('keyboard-shortcuts')}
				</ClayModal.Header>

				<ClayModal.Body>
					<dl className="editor-shortcut-list">
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
