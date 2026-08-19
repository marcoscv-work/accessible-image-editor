/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';

import {AdjustmentKey} from '../editorConfig';
import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {Adjustments} from '../state/types';
import {EditorSection} from './EditorSection';
import {CommitSlider} from './fields';

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

	/**
	 * Which sliders to expose, in canonical order.
	 */
	sliders: AdjustmentKey[];
}

/**
 * Clay sliders over the adjustment parameters. Slider movements dispatch
 * transient edits; releasing the pointer, releasing a key, or leaving the
 * slider commits the gesture as a single undo step and announces it.
 */
export function AdjustPanel({
	adjustments,
	dispatch,
	onAnnounce,
	sliders,
}: Props) {
	const shown = SLIDERS.filter(({key}) => sliders.includes(key));

	const hasAdjustments = shown.some(({key}) => adjustments[key] !== 0);

	return (
		<EditorSection title={t('adjustments')} titleId="adjust-panel-title">
			{shown.map(({key, labelKey}) => {
				const label = t(labelKey);
				const value = adjustments[key];

				return (
					<CommitSlider
						id={`adjust-${key}`}
						key={key}
						label={label}
						max={100}
						min={-100}
						onCancel={() => dispatch({type: 'cancel-gesture'})}
						onCommit={(next) => {
							dispatch({key, type: 'set-adjustment', value: next});

							onAnnounce(t('adjustment-set', label, next));
						}}
						onPreview={(next) =>
							dispatch({
								key,
								transient: true,
								type: 'set-adjustment',
								value: next,
							})
						}
						shiftStep={10}
						value={value}
						valueLabel={String(value)}
					>
						<ClayButtonWithIcon
							aria-label={t('reset-adjustment', label)}
							borderless
							className="editor-slider-reset"
							disabled={value === 0}
							displayType="secondary"
							onClick={() => {
								dispatch({key, type: 'set-adjustment', value: 0});
								onAnnounce(t('adjustment-set', label, 0));
							}}
							size="xs"
							symbol="restore"
							title={t('reset-adjustment', label)}
						/>
					</CommitSlider>
				);
			})}

			{hasAdjustments && (
				<div className="editor-panel-actions">
					<ClayButton
					displayType="secondary"
					onClick={() => {
						dispatch({type: 'reset-adjustments'});
						onAnnounce(t('adjustments-reset'));

						// This button disappears once everything is back
						// to zero: hand focus to the adjacent slider so
						// it is never dropped.

						window.setTimeout(
							() =>
								document
									.getElementById(
										`adjust-${shown[shown.length - 1].key}`
									)
									?.focus(),
							0
						);
					}}
					size="xs"
					>
						{t('reset-all')}
					</ClayButton>
				</div>
			)}
		</EditorSection>
	);
}
