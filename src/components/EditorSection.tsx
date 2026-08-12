/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayPanel from '@clayui/panel';
import React from 'react';

interface Props {
	children: React.ReactNode;

	/**
	 * Collapsed sections keep their content mounted but hidden with
	 * display:none, so it leaves the tab order and the accessibility tree.
	 */
	defaultExpanded?: boolean;

	title: string;

	/**
	 * Id given to the title element. Panels reference it from their inner
	 * controls (and the editor scrolls to it), so it must stay stable.
	 */
	titleId: string;
}

/**
 * A collapsible sidebar section built on ClayPanel: the header is a real
 * button carrying aria-expanded and aria-controls, so the disclosure
 * pattern comes from the design system rather than hand-rolled ARIA.
 */
export function EditorSection({
	children,
	defaultExpanded = true,
	title,
	titleId,
}: Props) {
	return (
		<ClayPanel
			className="editor-panel"
			collapsable
			collapseHeaderClassNames="mb-3"
			defaultExpanded={defaultExpanded}
			displayTitle={
				<span className="editor-panel-title panel-title" id={titleId}>
					{title}
				</span>
			}
			displayType="unstyled"
			showCollapseIcon
			size="sm"
		>
			<ClayPanel.Body>{children}</ClayPanel.Body>
		</ClayPanel>
	);
}
