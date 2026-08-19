/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import bundledSpritemap from '@clayui/css/lib/images/icons/icons.svg';
import {ClayIconSpriteContext} from '@clayui/icon';

import {AnnouncerProvider} from './components/Announcer';
import EditorModal, {EditorSaveResult} from './components/EditorModal';
import {EditorConfig} from './editorConfig';
import {LoadedImage} from './imaging/loadImage';

export type {EditorSaveResult};

export interface AccessibleImageEditorProps {
	image: LoadedImage;
	onClose: () => void;
	onSave: (
		result: EditorSaveResult,
		signal: AbortSignal
	) => Promise<void> | void;

	/**
	 * Which editing blocks and tools to expose; anything omitted keeps
	 * its default, so `{}` is the complete editor.
	 */
	config?: EditorConfig;

	/**
	 * The Clay icon spritemap to draw symbols from. Defaults to the
	 * bundled Clay sheet; a host embedded in the portal passes the
	 * portal's own.
	 */
	spritemap?: string;
}

/**
 * The public root: the editor with everything it needs to run brought
 * along. The announcer that turns state changes into screen reader
 * speech and the icon spritemap are provided here, so a host mounts one
 * component and owes it nothing but the props, and two instances on the
 * same page stay out of each other's way.
 */
export function AccessibleImageEditor({
	config,
	image,
	onClose,
	onSave,
	spritemap,
}: AccessibleImageEditorProps) {
	return (
		<ClayIconSpriteContext.Provider value={spritemap ?? bundledSpritemap}>
			<AnnouncerProvider>
				<EditorModal
					config={config}
					image={image}
					onClose={onClose}
					onSave={onSave}
				/>
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
