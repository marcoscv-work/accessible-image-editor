/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayButtonWithIcon} from '@clayui/button';
import ClayForm, {ClaySelectWithOption} from '@clayui/form';
import {useState} from 'react';

import {t} from '../i18n';
import {DEFAULT_BORDER_COLOR, overlayLabel} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {
	CircleOverlay,
	ImageOverlay,
	Overlay,
	RedactOverlay,
	ShapeOverlay,
	isBoxOverlay,
} from '../state/types';
import {FONT_FAMILIES} from '../textFonts';
import {ColorField, NumberField, TextField} from './fields';

interface LayerPropertiesProps {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	overlay: Overlay;
}

/**
 * Property editing for the selected layer: color, geometry, and text are
 * regular form controls dispatching parametric updates, so every visual
 * attribute stays editable after creation without any pointer work.
 */
export function LayerProperties({dispatch, onAnnounce, overlay}: LayerPropertiesProps) {
	const label = overlayLabel(overlay);

	/*
	 * A picture has proportions of its own, and stretching it is rarely
	 * what was meant, so it arrives with them locked. A rectangle, a
	 * circle and a redaction are shapes rather than pictures, so they
	 * arrive free, with the same padlock available.
	 */

	const [proportional, setProportional] = useState(overlay.kind === 'image');

	const commitPatch = (patch: Partial<Overlay>) => {
		dispatch({id: overlay.id, patch, type: 'update-overlay'});

		onAnnounce(t('layer-updated', label));
	};

	/**
	 * With the padlock on, the side that was not typed follows, so nobody
	 * has to work out what the other number should be. The ratio comes
	 * from the box as it stands, which is what the picture arrived with.
	 */
	const commitSize = (side: 'height' | 'width', value: number) => {
		if (!proportional || !isBoxOverlay(overlay)) {
			commitPatch({[side]: value});

			return;
		}

		const ratio = overlay.width / overlay.height;

		const other = Math.max(
			Math.round(side === 'width' ? value / ratio : value * ratio),
			1
		);

		commitPatch(
			side === 'width'
				? {height: other, width: value}
				: {height: value, width: other}
		);
	};

	return (
		<div
			aria-labelledby="layer-properties-title"
			className="editor-layer-properties"
			role="group"
		>
			{/*
			  * Not a heading: the sidebar sections are disclosure buttons
			  * now, so a heading here would break the document's heading
			  * order. The group is labelled by this text instead.
			  */}
			<div className="editor-panel-subtitle" id="layer-properties-title">
				{t('selected-layer', label)}
			</div>

			{overlay.kind === 'text' && (
				<TextField
					id="layer-prop-text"
					label={t('text-content')}
					onCommit={(text) => commitPatch({text})}
					value={overlay.text}
				/>
			)}

			{/*
			  * A picture carries no words of its own, so the only thing
			  * naming it for a screen reader is this field.
			  */}
			{overlay.kind === 'image' && (
				<TextField
					id="layer-prop-description"
					label={t('image-description')}
					onCommit={(description) => commitPatch({description})}
					value={overlay.description}
				/>
			)}

			<div className="editor-panel-grid">
				{overlay.kind === 'redact' && (
					<ClayForm.Group small>
						<label htmlFor="layer-prop-level">
							{t('redact-level')}
						</label>

						<ClaySelectWithOption
							id="layer-prop-level"
							onChange={(event) =>
								commitPatch({
									level: event.target
										.value as RedactOverlay['level'],
								})
							}
							options={[
								{
									label: t('redact-level-coarse'),
									value: 'coarse',
								},
								{
									label: t('redact-level-medium'),
									value: 'medium',
								},
								{label: t('redact-level-fine'), value: 'fine'},
								{label: t('redact-level-tiny'), value: 'tiny'},
							]}
							sizing="sm"
							value={overlay.level}
						/>
					</ClayForm.Group>
				)}

				{hasColor(overlay) && (
					<ColorField
						id="layer-prop-color"
						label={t('text-color')}
						onCommit={(color) => commitPatch({color})}
						onPreview={(color) =>
							dispatch({
								id: overlay.id,
								patch: {color},
								transient: true,
								type: 'update-overlay',
							})
						}
						value={overlay.color}
					/>
				)}

				<NumberField
					id="layer-prop-x"
					label={t('x-position')}
					min={-Infinity}
					onCommit={(x) => commitPatch({x})}
					value={Math.round(overlay.x)}
				/>

				<NumberField
					id="layer-prop-y"
					label={t('y-position')}
					min={-Infinity}
					onCommit={(y) => commitPatch({y})}
					value={Math.round(overlay.y)}
				/>

				<NumberField
					id="layer-prop-opacity"
					label={t('opacity')}
					max={100}
					min={0}
					onCommit={(opacity) => commitPatch({opacity})}
					suffix={t('unit-percent')}
					value={overlay.opacity ?? 100}
				/>

				<NumberField
					id="layer-prop-rotation"
					label={t('rotation-degrees')}
					max={360}
					min={-360}
					onCommit={(rotation) => commitPatch({rotation})}
					suffix={t('unit-degrees')}
					value={overlay.rotation ?? 0}
				/>

				{overlay.kind === 'sticker' && (
					<NumberField
						id="layer-prop-size"
						label={t('size')}
						min={8}
						onCommit={(size) => commitPatch({size})}
						value={overlay.size}
					/>
				)}

				{overlay.kind === 'text' && (
					<ClayForm.Group small>
						<label htmlFor="layer-prop-font-family">
							{t('font-family')}
						</label>

						<ClaySelectWithOption
							id="layer-prop-font-family"
							onChange={(event) =>
								commitPatch({
									fontFamily: event.target.value,
								})
							}
							options={FONT_FAMILIES.map(
								({labelKey, value}) => ({
									label: t(labelKey),
									value,
								})
							)}
							sizing="sm"
							value={overlay.fontFamily}
						/>
					</ClayForm.Group>
				)}

				{overlay.kind === 'text' && (
					<NumberField
						id="layer-prop-font-size"
						label={t('font-size')}
						min={8}
						onCommit={(fontSize) => commitPatch({fontSize})}
						value={overlay.fontSize}
					/>
				)}

				{isBoxOverlay(overlay) && (
					<div className="editor-crop-size-row editor-layer-size-row">
						<NumberField
							id="layer-prop-width"
							label={t('width')}
							onCommit={(width) => commitSize('width', width)}
							value={overlay.width}
						/>

						<ClayButtonWithIcon
							aria-label={t('aspect-lock')}
							aria-pressed={proportional}
							borderless
							className="editor-aspect-lock"
							displayType="secondary"
							onClick={() => {
								setProportional((locked) => {
									onAnnounce(
										t(
											locked
												? 'aspect-ratio-unlocked'
												: 'aspect-ratio-locked'
										)
									);

									return !locked;
								});
							}}
							size="xs"
							symbol={proportional ? 'lock' : 'unlock'}
							title={t('aspect-lock')}
						/>

						<NumberField
							id="layer-prop-height"
							label={t('height')}
							onCommit={(height) => commitSize('height', height)}
							value={overlay.height}
						/>
					</div>
				)}

				{hasBorder(overlay) && (
					<>
						<NumberField
							id="layer-prop-border-width"
							label={t('border-width')}
							min={0}
							onCommit={(borderWidth) =>
								commitPatch({borderWidth})
							}
							value={overlay.borderWidth ?? 0}
						/>

						<ColorField
							id="layer-prop-border-color"
							label={t('border-color')}
							onCommit={(borderColor) =>
								commitPatch({borderColor})
							}
							onPreview={(borderColor) =>
								dispatch({
									id: overlay.id,
									patch: {borderColor},
									transient: true,
									type: 'update-overlay',
								})
							}
							value={overlay.borderColor ?? DEFAULT_BORDER_COLOR}
						/>
					</>
				)}
			</div>
		</div>
	);
}

/**
 * Which overlays can carry an outline: the drawn shapes. A redaction is a
 * mosaic and a sticker brings its own artwork.
 */
/**
 * Everything but a redaction and a picture, which take their pixels from
 * elsewhere and have no fill of their own.
 */
function hasColor(
	overlay: Overlay
): overlay is Exclude<Overlay, ImageOverlay | RedactOverlay> {
	return overlay.kind !== 'image' && overlay.kind !== 'redact';
}

function hasBorder(
	overlay: Overlay
): overlay is CircleOverlay | ShapeOverlay {
	return overlay.kind === 'circle' || overlay.kind === 'shape';
}
