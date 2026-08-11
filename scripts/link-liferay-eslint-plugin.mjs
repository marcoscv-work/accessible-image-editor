/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * @liferay/eslint-config references @liferay/eslint-plugin-liferay, which
 * ships bundled inside the config package (in Liferay repos it resolves
 * through their workspace setup). Standalone consumers need this alias.
 */

import {existsSync, symlinkSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const LINK = path.join(ROOT, 'node_modules/@liferay/eslint-plugin-liferay');

try {
	unlinkSync(LINK);
}
catch {
	// Not present yet.
}

if (existsSync(path.join(ROOT, 'node_modules/@liferay/eslint-config'))) {
	symlinkSync('eslint-config/plugins/liferay', LINK);

	console.log('Linked @liferay/eslint-plugin-liferay');
}
