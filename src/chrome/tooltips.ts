/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/**
 * Clay's scope-based tooltip provider hides on delegated mouseout/blur
 * from the titled anchor. When the anchor unmounts while its tooltip is
 * open (closing the editor modal, deleting a layer row), that event never
 * fires and the tooltip is orphaned on screen.
 */

const PROBE_ATTRIBUTE = 'data-tooltip-dismiss-probe';

/**
 * Dispatches the exact event shape the provider's hide path expects: a
 * bubbling mouseout from a titled element with no relatedTarget. The
 * probe is flagged so the orphan watcher ignores its own removal.
 */
export function dismissTooltips(): void {
	const probe = document.createElement('span');

	probe.title = '-';
	probe.setAttribute(PROBE_ATTRIBUTE, '');
	probe.style.display = 'none';

	document.body.append(probe);

	probe.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));

	probe.remove();
}

/**
 * Self-healing watcher: whenever a subtree containing titled elements is
 * removed while a tooltip is open, dismiss it. The dismissal is deferred
 * to a macrotask and re-entrancy guarded, so the probe's own DOM churn
 * can never feed back into the observer. Returns the disposer.
 */
export function watchOrphanTooltips(): () => void {
	let pending = false;

	const observer = new MutationObserver((mutations) => {
		if (pending || !document.querySelector('.tooltip')) {
			return;
		}

		for (const mutation of mutations) {
			for (const node of mutation.removedNodes) {
				if (
					node instanceof Element &&
					!node.hasAttribute(PROBE_ATTRIBUTE) &&
					!node.classList.contains('tooltip') &&
					(node.matches('[title], [data-restore-title]') ||
						node.querySelector('[title], [data-restore-title]'))
				) {
					pending = true;

					window.setTimeout(() => {
						pending = false;

						if (document.querySelector('.tooltip')) {
							dismissTooltips();
						}
					}, 0);

					return;
				}
			}
		}
	});

	observer.observe(document.body, {childList: true, subtree: true});

	return () => observer.disconnect();
}
