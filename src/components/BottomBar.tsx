/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';
import {ClaySelectWithOption} from '@clayui/form';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {RatioPreset} from '../state/types';

const RATIO_OPTIONS: Array<{labelKey: string; value: RatioPreset}> = [
	{labelKey: 'ratio-custom', value: 'custom'},
	{labelKey: 'ratio-original', value: 'original'},
	{labelKey: '1:1', value: '1:1'},
	{labelKey: '4:3', value: '4:3'},
	{labelKey: '16:9', value: '16:9'},
	{labelKey: '3:4', value: '3:4'},
	{labelKey: '9:16', value: '9:16'},
];

interface Props {
	canRedo: boolean;
	canUndo: boolean;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	onCancel: () => void;
	onRedo: () => void;
	onSave: () => void;
	onShowShortcuts: () => void;
	onUndo: () => void;
	onZoom: (direction: -1 | 1) => void;
	onZoomFit: () => void;
	ratio: RatioPreset;
	saving: boolean;
	zoom: number;
}

export function BottomBar({
	canRedo,
	canUndo,
	dispatch,
	onAnnounce,
	onCancel,
	onRedo,
	onSave,
	onShowShortcuts,
	onUndo,
	onZoom,
	onZoomFit,
	ratio,
	saving,
	zoom,
}: Props) {
	return (
		<div className="editor-bottom-bar">
			<div className="editor-bar-group">
				<label
					className="editor-ratio-label"
					htmlFor="crop-ratio-select"
				>
					{t('ratio')}
				</label>

				<ClaySelectWithOption
					className="editor-ratio-select"
					id="crop-ratio-select"
					onChange={(event) => {
						dispatch({
							ratio: event.target.value as RatioPreset,
							type: 'set-ratio',
						});
					}}
					options={RATIO_OPTIONS.map(({labelKey, value}) => ({
						label: t(labelKey),
						value,
					}))}
					sizing="sm"
					value={ratio}
				/>

				<ClayButtonWithIcon
					aria-label={t('rotate-90')}
					className="editor-bar-button"
					displayType="unstyled"
					onClick={() => {
						dispatch({type: 'rotate-90'});
						onAnnounce(t('rotated-90'));
					}}
					symbol="rotate"
					title={t('rotate-90')}
				/>

				<ClayButtonWithIcon
					aria-label={t('undo')}
					className="editor-bar-button"
					disabled={!canUndo}
					displayType="unstyled"
					onClick={onUndo}
					symbol="undo"
					title={t('undo')}
				/>

				<ClayButtonWithIcon
					aria-label={t('redo')}
					className="editor-bar-button"
					disabled={!canRedo}
					displayType="unstyled"
					onClick={onRedo}
					symbol="redo"
					title={t('redo')}
				/>

				<ClayButtonWithIcon
					aria-label={t('keyboard-shortcuts')}
					className="editor-bar-button"
					displayType="unstyled"
					onClick={onShowShortcuts}
					symbol="question-circle"
					title={t('keyboard-shortcuts')}
				/>
			</div>

			<div className="editor-bar-group">
				<ClayButtonWithIcon
					aria-label={t('zoom-out')}
					className="editor-bar-button"
					displayType="unstyled"
					onClick={() => onZoom(-1)}
					symbol="minus-circle"
					title={t('zoom-out')}
				/>

				<span className="editor-zoom-level">
					{Math.round(zoom * 100)}%
				</span>

				<ClayButtonWithIcon
					aria-label={t('zoom-in')}
					className="editor-bar-button"
					displayType="unstyled"
					onClick={() => onZoom(1)}
					symbol="plus"
					title={t('zoom-in')}
				/>

				<ClayButtonWithIcon
					aria-label={t('zoom-fit')}
					className="editor-bar-button"
					displayType="unstyled"
					onClick={onZoomFit}
					symbol="autosize"
					title={t('zoom-fit')}
				/>
			</div>

			<div className="editor-bar-group">
				<ClayButton
					className="editor-cancel-button mr-3"
					displayType="unstyled"
					onClick={onCancel}
				>
					{t('cancel')}
				</ClayButton>

				<ClayButton
					disabled={saving}
					displayType="primary"
					onClick={onSave}
				>
					{t('save')}
				</ClayButton>
			</div>
		</div>
	);
}
