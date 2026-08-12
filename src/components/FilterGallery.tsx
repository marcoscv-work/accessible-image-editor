/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {t} from '../i18n';
import {FILTER_PRESETS, FilterDefs} from '../imaging/FilterDefs';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {DEFAULT_ADJUSTMENTS, FilterPreset} from '../state/types';
import {EditorSection} from './EditorSection';

interface Props {
	dispatch: (action: EditorAction) => void;
	filter: FilterPreset;
	image: LoadedImage;
	onAnnounce: (message: string) => void;
}

/**
 * The filter presets as a native radio group (Clay custom-radio markup);
 * each option carries a live thumbnail rendered through the exact same
 * filter pipeline the preview and the export use.
 */
export function FilterGallery({dispatch, filter, image, onAnnounce}: Props) {
	return (
		<EditorSection title={t('filters')} titleId="filters-panel-title">
			<fieldset>
				<legend className="sr-only">{t('filters')}</legend>

				<div className="editor-filter-grid">
					{FILTER_PRESETS.map((preset) => {
						const label = t(`filter-${preset}`);

						return (
							<div
								className="custom-control custom-radio editor-filter-option"
								key={preset}
							>
								<input
									checked={filter === preset}
									className="editor-filter-input sr-only"
									id={`filter-${preset}`}
									name="filter-preset"
									onChange={() => {
										dispatch({
											filter: preset,
											type: 'set-filter',
										});
										onAnnounce(t('filter-set', label));
									}}
									type="radio"
									value={preset}
								/>

								<label
									className="editor-filter-label"
									htmlFor={`filter-${preset}`}
								>
									<span className="editor-filter-card">
										<svg
											aria-hidden="true"
											className="editor-filter-thumb"
											height={48}
											viewBox="0 0 72 48"
											width={72}
										>
											<defs>
												<FilterDefs
													adjustments={
														DEFAULT_ADJUSTMENTS
													}
													filter={preset}
													id={`filter-thumb-${preset}`}
												/>
											</defs>

											<image
												filter={
													preset === 'none'
														? undefined
														: `url(#filter-thumb-${preset})`
												}
												height={48}
												href={image.thumbUrl}
												preserveAspectRatio="xMidYMid slice"
												width={72}
											/>
										</svg>
									</span>

									<span className="editor-filter-name">
										{label}
									</span>
								</label>
							</div>
						);
					})}
				</div>
			</fieldset>
		</EditorSection>
	);
}
