/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * The module's public surface, and the only import path a host needs:
 * the editor itself, the props that drive it, and the types its
 * contracts are written in.
 */
export {ImageEditor, sessionKeyOf} from './ImageEditor';
export type {EditorSaveResult, ImageEditorProps} from './ImageEditor';
export type {EditorConfig} from './editorConfig';
export type {EditorMessages, TranslationKey} from './i18n';
export {setMessages} from './i18n';
export type {LoadedImage} from './imaging/loadImage';
export {loadImage} from './imaging/loadImage';
