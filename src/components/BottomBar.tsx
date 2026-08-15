/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';
import {ClaySelectWithOption} from '@clayui/form';
import ClayModal from '@clayui/modal';

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

	/**
	 * Ratio presets to offer; an empty list hides the control.
	 */
	ratios: RatioPreset[];

	saving: boolean;
	showRotate: boolean;
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
	ratios,
	saving,
	showRotate,
	zoom,
}: Props) {
	/*
	 * A standard modal footer rather than a bar of our own: Lexicon gives it
	 * the light surface, the top border and the trailing alignment of the
	 * last group, which means the colour scheme of the theme inverts it
	 * along with the rest of the dialog instead of leaving a dark strip.
	 */

	return (
		<ClayModal.Footer
			className="editor-bottom-bar"
			first={
				<div className="editor-bar-group">
				{ratios.length > 0 && (
					<>
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
							options={RATIO_OPTIONS.filter(({value}) =>
								ratios.includes(value)
							).map(({labelKey, value}) => ({
								label: t(labelKey),
								value,
							}))}
							sizing="sm"
							value={ratio}
						/>
					</>
				)}

				{showRotate && (
					<>
						<ClayButtonWithIcon
							aria-label={t('rotate-90')}
							borderless
							className="editor-bar-button"
							displayType="secondary"
							onClick={() => {
								dispatch({type: 'rotate-90'});
								onAnnounce(t('rotated-90'));
							}}
							symbol="rotate"
							title={t('rotate-90')}
						/>

						{/*
						  * Clay has no flip glyph, so the icon is drawn here:
						  * two shapes facing each other across the axis they
						  * mirror about.
						  */}
						<ClayButton
							aria-label={t('flip-horizontal')}
							borderless
							className="btn-monospaced editor-bar-button"
							displayType="secondary"
							onClick={() => {
								dispatch({type: 'flip-horizontal'});
								onAnnounce(t('flipped-horizontal'));
							}}
							title={t('flip-horizontal')}
						>
							<svg
								aria-hidden="true"
								focusable="false"
								height="16"
								viewBox="0 0 16 16"
								width="16"
							>
								<path
									d="M7.25 1.5h1.5v13h-1.5z"
									fill="currentColor"
									opacity="0.55"
								/>
								<path
									d="M5.75 3.75v8.5H2.4a.4.4 0 0 1-.32-.64l3.35-8.1a.2.2 0 0 1 .32.24Z"
									fill="currentColor"
								/>
								<path
									d="M10.25 3.75v8.5h3.35a.4.4 0 0 0 .32-.64l-3.35-8.1a.2.2 0 0 0-.32.24Z"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.3"
								/>
							</svg>
						</ClayButton>
					</>
				)}

				<ClayButtonWithIcon
					aria-label={t('undo')}
					borderless
					className="editor-bar-button"
					disabled={!canUndo}
							displayType="secondary"
					onClick={onUndo}
					symbol="undo"
					title={t('undo')}
				/>

				<ClayButtonWithIcon
					aria-label={t('redo')}
					borderless
					className="editor-bar-button"
					disabled={!canRedo}
							displayType="secondary"
					onClick={onRedo}
					symbol="redo"
					title={t('redo')}
				/>

				<ClayButtonWithIcon
					aria-label={t('keyboard-shortcuts')}
					borderless
					className="editor-bar-button"
							displayType="secondary"
					onClick={onShowShortcuts}
					symbol="question-circle"
					title={t('keyboard-shortcuts')}
				/>
				</div>
			}
			last={
				<div className="editor-bar-group">
					<ClayButton
						displayType="secondary"
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
			}
			middle={
				<div className="editor-bar-group">
					<ClayButtonWithIcon
						aria-label={t('zoom-out')}
					borderless
					className="editor-bar-button"
							displayType="secondary"
					onClick={() => onZoom(-1)}
					symbol="minus-circle"
					title={t('zoom-out')}
				/>

				<span className="editor-zoom-level">
					{t('zoom-percent', Math.round(zoom * 100))}
				</span>

				<ClayButtonWithIcon
					aria-label={t('zoom-in')}
					borderless
					className="editor-bar-button"
							displayType="secondary"
					onClick={() => onZoom(1)}
					symbol="plus-circle-full"
					title={t('zoom-in')}
				/>

				<ClayButtonWithIcon
					aria-label={t('zoom-fit')}
					borderless
					className="editor-bar-button"
							displayType="secondary"
					onClick={onZoomFit}
						symbol="autosize"
						title={t('zoom-fit')}
					/>
				</div>
			}
		/>
	);
}
