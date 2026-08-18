/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Identifiers for the things a session creates. They are part of the edit
 * state, so they have to be stable, unique and readable in a serialized
 * session: `emoji-9f3a1c2b` says what it is at a glance.
 */
export function nextId(kind: string): string {
	return `${kind}-${crypto.randomUUID().slice(0, 8)}`;
}
