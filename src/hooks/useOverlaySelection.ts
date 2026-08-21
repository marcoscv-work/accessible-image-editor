/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {Overlay} from '../state/types';

/**
 * Which annotation is selected, which set moves together, and the
 * padlock default that follows the selection. The group's life is all
 * here: seeded from the standing selection on Shift+click, dissolved by
 * a plain click outside its members, never smaller than two.
 */
export function useOverlaySelection(
	overlays: Overlay[],
	announce: (message: string) => void
) {
	const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);

	const [layerProportional, setLayerProportional] = useState(false);

	const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
		null
	);

	const selectOverlay = (id: string | null) => {
		setSelectedOverlayId(id);

		// A plain selection outside the group dissolves it, and so does
		// deselecting: the set survives only plain clicks on its own
		// members, which is how the group is dragged.

		setMultiSelectedIds((currentIds) =>
			id !== null && currentIds.includes(id) ? currentIds : []
		);
	};

	const toggleMultiSelect = (id: string) => {
		const removing = multiSelectedIds.includes(id);

		// A Shift+click with a standing plain selection reads as "these
		// two together": the group is seeded with what was already
		// selected, the way every editor treats it.

		const base = multiSelectedIds.length
			? multiSelectedIds
			: selectedOverlayId && selectedOverlayId !== id
				? [selectedOverlayId]
				: [];

		const next = removing
			? multiSelectedIds.filter((candidate) => candidate !== id)
			: [...base, id];

		if (next.length >= 2) {

			// The count is spoken by the layers panel's own status note,
			// which changes in the same render: announcing it here too
			// would say everything twice.

			setMultiSelectedIds(next);
		}
		else {

			// A group of one is just a selection: dissolve rather than
			// keep an invisible group around.

			setMultiSelectedIds([]);

			if (multiSelectedIds.length >= 2) {
				announce(t('annotations-ungrouped'));
			}
		}

		setSelectedOverlayId(id);
	};

	// Only when the selection changes does the padlock reset: it is the
	// reader's to set once they are on a layer. The previous id is
	// tracked so the effect can run under its full dependency list and
	// still leave the padlock alone while the same layer merely updates.

	const previousSelectedIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (previousSelectedIdRef.current === selectedOverlayId) {
			return;
		}

		previousSelectedIdRef.current = selectedOverlayId;

		const overlay = overlays.find(
			(candidate) => candidate.id === selectedOverlayId
		);

		setLayerProportional(overlay?.kind === 'image');
	}, [overlays, selectedOverlayId]);

	return {
		layerProportional,
		multiSelectedIds,
		selectOverlay,
		selectedOverlayId,
		setLayerProportional,
		setMultiSelectedIds,
		setSelectedOverlayId,
		toggleMultiSelect,
	};
}
