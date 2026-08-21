/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayForm, {ClaySelectWithOption} from '@clayui/form';
import {memo} from 'react';

import {EditorSection} from '../chrome/EditorSection';
import {ColorField, CommitSlider} from '../chrome/fields';
import {useEditorId} from '../chrome/instance';
import {TranslationKey, t} from '../i18n';
import {FrameShape} from '../imaging/frameShapes';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {Frame, FrameKind} from '../state/types';
import {PresetGallery} from './PresetGallery';

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

const SLIDERS: {key: 'offset' | 'size'; labelKey: TranslationKey; max: number}[] = [
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
	const eid = useEditorId();

	return (
		<EditorSection title={t('frame')} titleId={eid('frame-panel-title')}>
			<PresetGallery
				idPrefix={eid('frame')}
				items={presets}
				label={(kind) => t(`frame-${kind}`)}
				legend={t('frame')}
				onSelect={(kind) => {
					dispatch({frame: {kind}, type: 'set-frame'});

					onAnnounce(t('frame-set', t(`frame-${kind}`)));
				}}
				preview={(kind) => (
					<svg
						aria-hidden="true"
						className="editor-preset-thumb"
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

						<FrameShape crop={CARD} frame={{...frame, kind}} />
					</svg>
				)}
				selected={frame.kind}
			/>

			{/*
			  * The options only exist once there is something to configure,
			  * and "None" is not a frame with a thin white border.
			  */}
			{frame.kind !== 'none' && (
				<>
					{/*
					  * One row, two labelled controls: the colour beside
					  * where the frame sits. A mat that hides the caption
					  * someone wrote along the bottom edge is a real
					  * outcome, and which side of the annotations the frame
					  * belongs on is theirs to say.
					  */}
					<div className="editor-panel-grid">
						<ColorField
							fill
							id={eid('frame-color')}
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

						<ClayForm.Group small>
							<label htmlFor={eid('frame-placement')}>
								{t('frame-placement')}
							</label>

							<ClaySelectWithOption
								id={eid('frame-placement')}
								onChange={(event) => {
									const overAnnotations =
										event.target.value === 'over';

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
								options={[
									{
										label: t('frame-placement-over'),
										value: 'over',
									},
									{
										label: t('frame-placement-under'),
										value: 'under',
									},
								]}
								sizing="sm"
								value={
									frame.overAnnotations ? 'over' : 'under'
								}
							/>
						</ClayForm.Group>
					</div>

					{SLIDERS.map(({key, labelKey, max}) => {
						const label = t(labelKey);

						return (
							<CommitSlider
								id={eid(`frame-${key}`)}
								key={key}
								label={label}
								max={max}
								min={0}
								onCancel={() =>
									dispatch({type: 'cancel-gesture'})
								}
								onCommit={(value) => {
									dispatch({
										frame: {[key]: value},
										type: 'set-frame',
									});

									onAnnounce(
										t('x-set-to-x-percent', label, value)
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
