/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayForm from '@clayui/form';
import ClaySlider from '@clayui/slider';
import {memo, useRef} from 'react';

import {t} from '../i18n';
import {FrameShape} from '../imaging/frameShapes';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {Frame, FrameKind} from '../state/types';
import {Carousel} from './Carousel';
import {EditorSection} from './EditorSection';

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
	const colorGesture = useRef(false);
	const sliderGesture = useRef<'offset' | 'size' | null>(null);

	const commitSlider = (key: 'offset' | 'size', label: string) => {
		if (sliderGesture.current !== key) {
			return;
		}

		sliderGesture.current = null;

		dispatch({frame: {[key]: frame[key]}, type: 'set-frame'});

		onAnnounce(t('frame-value-set', label, frame[key]));
	};

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
					<ClayForm.Group small>
						<label htmlFor="frame-color">{t('frame-color')}</label>

						<input
							className="editor-color-input form-control form-control-sm"
							id="frame-color"
							onBlur={() => {
								if (colorGesture.current) {
									colorGesture.current = false;

									dispatch({
										frame: {color: frame.color},
										type: 'set-frame',
									});

									onAnnounce(t('frame-color-set'));
								}
							}}
							onChange={(event) => {
								colorGesture.current = true;

								dispatch({
									frame: {color: event.target.value},
									transient: true,
									type: 'set-frame',
								});
							}}
							type="color"
							value={frame.color}
						/>
					</ClayForm.Group>

					{SLIDERS.map(({key, labelKey, max}) => {
						const label = t(labelKey);
						const value = frame[key];

						return (
							<ClayForm.Group key={key} small>
								<div className="editor-slider-row">
									<label htmlFor={`frame-${key}`}>
										{label}
									</label>

									<span
										aria-hidden="true"
										className="editor-slider-value"
									>
										{t('frame-percent', value)}
									</span>
								</div>

								<ClaySlider
									id={`frame-${key}`}
									max={max}
									min={0}
									onBlur={() => commitSlider(key, label)}
									onChange={(next: number) => {
										sliderGesture.current = key;

										dispatch({
											frame: {[key]: next},
											transient: true,
											type: 'set-frame',
										});
									}}
									onKeyUp={() => commitSlider(key, label)}
									onPointerUp={() => commitSlider(key, label)}
									showTooltip={false}
									value={value}
								/>
							</ClayForm.Group>
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
