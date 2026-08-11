/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';
import ClayForm from '@clayui/form';
import ClaySlider from '@clayui/slider';
import {useRef} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {Adjustments} from '../state/types';

const SLIDERS: Array<{key: keyof Adjustments; labelKey: string}> = [
	{key: 'brightness', labelKey: 'brightness'},
	{key: 'contrast', labelKey: 'contrast'},
	{key: 'saturation', labelKey: 'saturation'},
	{key: 'shadows', labelKey: 'shadows'},
	{key: 'highlights', labelKey: 'highlights'},
];

interface Props {
	adjustments: Adjustments;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
}

/**
 * Clay sliders over the adjustment parameters. Slider movements dispatch
 * transient edits; releasing the pointer, releasing a key, or leaving the
 * slider commits the gesture as a single undo step and announces it.
 */
export function AdjustPanel({adjustments, dispatch, onAnnounce}: Props) {
	const activeGesture = useRef<keyof Adjustments | null>(null);

	const commit = (key: keyof Adjustments, label: string) => {
		if (activeGesture.current !== key) {
			return;
		}

		activeGesture.current = null;

		dispatch({key, type: 'set-adjustment', value: adjustments[key]});

		onAnnounce(t('adjustment-set', label, adjustments[key]));
	};

	return (
		<section aria-labelledby="adjust-panel-title" className="editor-panel">
			<div className="editor-panel-header">
				<h2 className="editor-panel-title" id="adjust-panel-title">
					{t('adjustments')}
				</h2>

				<ClayButton
					displayType="secondary"
					onClick={() => {
						dispatch({type: 'reset-adjustments'});
						onAnnounce(t('adjustments-reset'));
					}}
					size="xs"
				>
					{t('reset-all')}
				</ClayButton>
			</div>

			{SLIDERS.map(({key, labelKey}) => {
				const label = t(labelKey);
				const value = adjustments[key];

				return (
					<ClayForm.Group key={key}>
						<div className="editor-slider-row">
							<label htmlFor={`adjust-${key}`}>{label}</label>

							<span
								aria-hidden="true"
								className="editor-slider-value"
							>
								{value}
							</span>

							<ClayButtonWithIcon
								aria-label={t('reset-adjustment', label)}
								className="editor-slider-reset"
								disabled={value === 0}
								displayType="unstyled"
								onClick={() => {
									dispatch({
										key,
										type: 'set-adjustment',
										value: 0,
									});
									onAnnounce(t('adjustment-set', label, 0));
								}}
								size="xs"
								symbol="restore"
								title={t('reset-adjustment', label)}
							/>
						</div>

						<ClaySlider
							id={`adjust-${key}`}
							max={100}
							min={-100}
							onBlur={() => commit(key, label)}
							onChange={(next: number) => {
								activeGesture.current = key;

								dispatch({
									key,
									transient: true,
									type: 'set-adjustment',
									value: next,
								});
							}}
							onKeyUp={() => commit(key, label)}
							onPointerUp={() => commit(key, label)}
							showTooltip={false}
							value={value}
						/>
					</ClayForm.Group>
				);
			})}
		</section>
	);
}
