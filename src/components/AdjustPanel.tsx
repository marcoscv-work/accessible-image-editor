/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';
import ClayForm from '@clayui/form';
import ClaySlider from '@clayui/slider';
import React, {useRef} from 'react';

import {AdjustmentKey} from '../editorConfig';
import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {Adjustments} from '../state/types';
import {EditorSection} from './EditorSection';

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

	const activeGesture = useRef<keyof Adjustments | null>(null);

	const commit = (key: keyof Adjustments, label: string) => {
		if (activeGesture.current !== key) {
			return;
		}

		activeGesture.current = null;

		dispatch({key, type: 'set-adjustment', value: adjustments[key]});

		onAnnounce(t('adjustment-set', label, adjustments[key]));
	};

	const hasAdjustments = shown.some(({key}) => adjustments[key] !== 0);

	return (
		<EditorSection title={t('adjustments')} titleId="adjust-panel-title">
			{shown.map(({key, labelKey}) => {
				const label = t(labelKey);
				const value = adjustments[key];

				return (
					<ClayForm.Group key={key} small>
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
								borderless
								className="editor-slider-reset"
								disabled={value === 0}
							displayType="secondary"
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
							onKeyDown={(event: React.KeyboardEvent) => {

								// Native ranges step by 1; Shift+arrows
								// steps by 10.

								if (!event.shiftKey) {
									return;
								}

								const delta =
									event.key === 'ArrowRight' ||
									event.key === 'ArrowUp'
										? 10
										: event.key === 'ArrowLeft' ||
											  event.key === 'ArrowDown'
											? -10
											: 0;

								if (!delta) {
									return;
								}

								event.preventDefault();

								activeGesture.current = key;

								dispatch({
									key,
									transient: true,
									type: 'set-adjustment',
									value: Math.max(
										-100,
										Math.min(100, value + delta)
									),
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
