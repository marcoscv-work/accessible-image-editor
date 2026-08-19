/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {memo} from 'react';

import {t} from '../i18n';
import {FilterDefs} from '../imaging/FilterDefs';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {DEFAULT_ADJUSTMENTS, FilterPreset} from '../state/types';
import {EditorSection} from './EditorSection';
import {PresetGallery} from './PresetGallery';
import {useEditorId} from './instance';

interface Props {
	dispatch: (action: EditorAction) => void;
	filter: FilterPreset;
	image: LoadedImage;
	onAnnounce: (message: string) => void;

	/**
	 * Which presets to offer, in canonical order.
	 */
	presets: FilterPreset[];
}

/**
 * The filter presets as a native radio group (Clay custom-radio markup);
 * each option carries a live thumbnail rendered through the exact same
 * filter pipeline the preview and the export use.
 */
function FilterGalleryCards({
	dispatch,
	filter,
	image,
	onAnnounce,
	presets,
}: Props) {
	const eid = useEditorId();

	return (
		<EditorSection title={t('filters')} titleId={eid('filters-panel-title')}>
			<PresetGallery
				idPrefix={eid('filter')}
				items={presets}
				label={(preset) => t(`filter-${preset}`)}
				legend={t('filters')}
				onSelect={(preset) => {
					dispatch({filter: preset, type: 'set-filter'});

					onAnnounce(t('filter-set', t(`filter-${preset}`)));
				}}
				preview={(preset) => (
					<svg
						aria-hidden="true"
						className="editor-preset-thumb"
						height={48}
						viewBox="0 0 72 48"
						width={72}
					>
						<defs>
							<FilterDefs
								adjustments={DEFAULT_ADJUSTMENTS}
								filter={preset}
								id={eid(`filter-thumb-${preset}`)}
							/>
						</defs>

						<image
							filter={
								preset === 'none'
									? undefined
									: `url(#${eid(`filter-thumb-${preset}`)})`
							}
							height={48}
							href={image.thumbUrl}
							preserveAspectRatio="xMidYMid slice"
							width={72}
						/>
					</svg>
				)}
				selected={filter}
			/>
		</EditorSection>
	);
}

/*
 * The cards are the most expensive thing in the sidebar, and none of them
 * change while a crop or an annotation is being dragged: memoized, they
 * are drawn once per actual change instead of once per pointer move.
 */

export const FilterGallery = memo(FilterGalleryCards);
