/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayForm, {ClayCheckbox} from '@clayui/form';
import {memo} from 'react';

import {t} from '../i18n';
import {FrameShape} from '../imaging/frameShapes';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {Frame, FrameKind} from '../state/types';
import {Carousel} from './Carousel';
import {EditorSection} from './EditorSection';
import {ColorField, CommitSlider} from './fields';

interface Props {
	dispatch: (action: EditorAction) => void;
	frame: Frame;
	image: LoadedImage;
	onAnnounce: (message: string) => void;

	/**
	 * Which frames to offer, in canonical order.
	 */
	presets: FrameKind[];
}

const CARD = {height: 48, width: 72, x: 0, y: 0};

const SLIDERS: {key: 'offset' | 'size'; labelKey: string; max: number}[] = [
	{key: 'size', labelKey: 'frame-size', max: 20},
	{key: 'offset', labelKey: 'frame-offset', max: 15},
];

/**
 * The frame: one at a time, like a filter, and configurable once chosen.
 * Each card previews the real thing, because the card and the stage draw
 * through the same component; it is measured against the crop rectangle,
 * so cropping again reframes the picture instead of stranding the border
 * where the old edges used to be.
 */
function FramePanelCards({dispatch, frame, image, onAnnounce, presets}: Props) {
	return (
		<EditorSection title={t('frame')} titleId="frame-panel-title">
			<fieldset>
				<legend className="sr-only">{t('frame')}</legend>

				<Carousel className="editor-frame-grid" itemCount={presets.length}>
					{presets.map((kind) => {
						const label = t(`frame-${kind}`);

						return (
							<div
								className="custom-control custom-radio editor-frame-option"
								key={kind}
							>
								<input
									checked={frame.kind === kind}
									className="editor-frame-input sr-only"
									id={`frame-${kind}`}
									name="frame-preset"
									onChange={() => {
										dispatch({
											frame: {kind},
											type: 'set-frame',
										});
										onAnnounce(t('frame-set', label));
									}}
									type="radio"
									value={kind}
								/>

								<label
									className="editor-frame-label"
									htmlFor={`frame-${kind}`}
								>
									<span className="editor-frame-card">
										<svg
											aria-hidden="true"
											className="editor-frame-thumb"
											height={CARD.height}
											viewBox={`0 0 ${CARD.width} ${CARD.height}`}
											width={CARD.width}
										>
											<image
												height={CARD.height}
												href={image.thumbUrl}
												preserveAspectRatio="xMidYMid slice"
												width={CARD.width}
											/>

											<FrameShape
												crop={CARD}
												frame={{...frame, kind}}
											/>
										</svg>
									</span>

									<span className="editor-frame-name">
										{label}
									</span>
								</label>
							</div>
						);
					})}
				</Carousel>
			</fieldset>

			{/*
			  * The options only exist once there is something to configure,
			  * and "None" is not a frame with a thin white border.
			  */}
			{frame.kind !== 'none' && (
				<>
					<ColorField
						id="frame-color"
						label={t('frame-color')}
						onCommit={(color) => {
							dispatch({frame: {color}, type: 'set-frame'});

							onAnnounce(t('frame-color-set'));
						}}
						onPreview={(color) =>
							dispatch({
								frame: {color},
								transient: true,
								type: 'set-frame',
							})
						}
						value={frame.color}
					/>

					{/*
					  * A mat that hides the caption someone wrote along the
					  * bottom edge is a real outcome, and which side of the
					  * annotations the frame belongs on is theirs to say.
					  */}
					<ClayForm.Group small>
						<ClayCheckbox
							checked={frame.overAnnotations}
							id="frame-over-annotations"
							label={t('frame-over-annotations')}
							onChange={() => {
								const overAnnotations = !frame.overAnnotations;

								dispatch({
									frame: {overAnnotations},
									type: 'set-frame',
								});

								onAnnounce(
									t(
										overAnnotations
											? 'frame-over-annotations-set'
											: 'frame-under-annotations-set'
									)
								);
							}}
						/>
					</ClayForm.Group>

					{SLIDERS.map(({key, labelKey, max}) => {
						const label = t(labelKey);

						return (
							<CommitSlider
								id={`frame-${key}`}
								key={key}
								label={label}
								max={max}
								min={0}
								onCommit={(value) => {
									dispatch({
										frame: {[key]: value},
										type: 'set-frame',
									});

									onAnnounce(
										t('frame-value-set', label, value)
									);
								}}
								onPreview={(value) =>
									dispatch({
										frame: {[key]: value},
										transient: true,
										type: 'set-frame',
									})
								}
								shiftStep={5}
								value={frame[key]}
								valueLabel={t('frame-percent', frame[key])}
							/>
						);
					})}
				</>
			)}
		</EditorSection>
	);
}

/*
 * The cards are the most expensive thing in the sidebar, and none of them
 * change while a crop or an annotation is being dragged: memoized, they
 * are drawn once per actual change instead of once per pointer move.
 */

export const FramePanel = memo(FramePanelCards);
