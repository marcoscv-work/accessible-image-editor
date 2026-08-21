/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import './css/ImageEditor.css';

import {ClayIconSpriteContext} from '@clayui/icon';
import {useState} from 'react';

import {AnnouncerProvider} from './chrome/Announcer';
import EditorModal, {EditorSaveResult} from './editor/EditorModal';
import {EditorConfig} from './editorConfig';
import {EditorMessages, setMessages} from './i18n';
import {LoadedImage} from './imaging/loadImage';

export type {EditorSaveResult};

/**
 * What identifies an editing session: the image itself. A host that
 * swaps the `image` prop on a mounted editor gets a fresh session, not
 * the previous image's crop, zoom, overlays and history draped over new
 * pixels. The preview URL is unique per loaded image (`loadImage` mints
 * an object URL per call), which is what makes it the key.
 */
export function sessionKeyOf(image: LoadedImage): string {
	return image.previewUrl;
}

export interface ImageEditorProps {
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
	 * The Clay icon spritemap to draw symbols from. In the portal this
	 * is the theme's own sheet
	 * (`themeDisplay.getPathThemeSpritemap()`); the demo shell passes
	 * the Clay one it bundles. The library bundles no asset of its own.
	 */
	spritemap: string;

	/**
	 * How the host localizes the editor: the same shape as a Clay
	 * component's `messages` prop, a partial dictionary whose missing
	 * keys keep the bundled English. In the portal, generate it with
	 * `scripts/generate-liferay-messages.mjs` (one literal
	 * `Liferay.Language.get` call per key). Read once, when the editor
	 * mounts: one locale per page, as in the portal itself.
	 */
	messages?: EditorMessages;
}

/**
 * The public root: the editor with everything it needs to run brought
 * along. The announcer that turns state changes into screen reader
 * speech and the icon spritemap are provided here, so a host mounts one
 * component and owes it nothing but the props, and two instances on the
 * same page stay out of each other's way.
 */
export function ImageEditor({
	config,
	image,
	messages,
	onClose,
	onSave,
	spritemap,
}: ImageEditorProps) {

	// Installed before the first child asks for a string, and only
	// then: the locale is page configuration, not component state, so
	// there is nothing to keep in sync and no unmount reset to pull the
	// dictionary out from under a sibling editor. (The initializer runs
	// during render; setting the same dictionary twice under Strict
	// Mode is idempotent.)

	useState(() => {
		if (messages) {
			setMessages(messages);
		}

		return null;
	});

	return (
		<ClayIconSpriteContext.Provider value={spritemap}>
			<AnnouncerProvider>
				<EditorModal
					config={config}
					image={image}
					key={sessionKeyOf(image)}
					onClose={onClose}
					onSave={onSave}
				/>
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
