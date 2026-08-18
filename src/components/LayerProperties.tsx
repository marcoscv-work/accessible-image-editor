/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayButtonWithIcon} from '@clayui/button';
import ClayForm, {ClaySelectWithOption} from '@clayui/form';

import {t} from '../i18n';
import {DEFAULT_BORDER_COLOR, overlayLabel} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {
	ArrowOverlay,
	CircleOverlay,
	ImageOverlay,
	Overlay,
	RedactOverlay,
	ShapeOverlay,
	isBoxOverlay,
} from '../state/types';
import {FONT_FAMILIES} from '../textFonts';
import {BorderField, ColorField, NumberField, TextField} from './fields';

interface LayerPropertiesProps {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	onProportionalChange: (proportional: boolean) => void;
	overlay: Overlay;

	/**
	 * Whether width and height move together. The stage reads it too, so
	 * the editor holds it rather than this panel.
	 */
	proportional: boolean;
}

/**
 * Property editing for the selected layer: color, geometry, and text are
 * regular form controls dispatching parametric updates, so every visual
 * attribute stays editable after creation without any pointer work.
 */
export function LayerProperties({
	dispatch,
	onAnnounce,
	onProportionalChange,
	overlay,
	proportional,
}: LayerPropertiesProps) {
	const label = overlayLabel(overlay);

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

	const pairedWithColor = hasColor(overlay) || overlay.kind === 'redact';

	const opacityField = (
		<NumberField
			id="layer-prop-opacity"
			label={t('opacity')}
			max={100}
			min={0}
			onCommit={(opacity) => commitPatch({opacity})}
			suffix={t('unit-percent')}
			value={overlay.opacity ?? 100}
		/>
	);

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
						fill
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

				{/*
				  * Opacity pairs with whatever cell is beside it. When the
				  * annotation has a colour or a redaction level, that is the
				  * one; otherwise it waits and pairs with the rotation
				  * below, so no row of the grid is left half empty.
				  */}
				{pairedWithColor && opacityField}

				{overlay.kind === 'arrow' && (
					<ClayForm.Group small>
						<label htmlFor="layer-prop-head">
							{t('arrow-head')}
						</label>

						<ClaySelectWithOption
							id="layer-prop-head"
							onChange={(event) =>
								commitPatch({
									head: event.target
										.value as ArrowOverlay['head'],
								})
							}
							options={[
								{
									label: t('arrow-head-filled'),
									value: 'filled',
								},
								{label: t('arrow-head-open'), value: 'open'},
							]}
							sizing="sm"
							value={overlay.head}
						/>
					</ClayForm.Group>
				)}

				{/*
				  * The tip, as a place rather than as a vector. Someone
				  * pointing an arrow thinks about where it lands, not about
				  * how far it travelled, and this is also the pointer-free
				  * way to aim it (WCAG 2.2, 2.5.7).
				  */}
				{overlay.kind === 'arrow' && (
					<NumberField
						id="layer-prop-tip-x"
						label={t('tip-x-position')}
						min={-Infinity}
						onCommit={(tipX) =>
							commitPatch({dx: Math.round(tipX - overlay.x)})
						}
						value={Math.round(overlay.x + overlay.dx)}
					/>
				)}

				{overlay.kind === 'arrow' && (
					<NumberField
						id="layer-prop-tip-y"
						label={t('tip-y-position')}
						min={-Infinity}
						onCommit={(tipY) =>
							commitPatch({dy: Math.round(tipY - overlay.y)})
						}
						value={Math.round(overlay.y + overlay.dy)}
					/>
				)}

				{overlay.kind === 'arrow' && (
					<NumberField
						id="layer-prop-thickness"
						label={t('thickness')}
						min={1}
						onCommit={(thickness) => commitPatch({thickness})}
						value={overlay.thickness}
					/>
				)}

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
								onAnnounce(
									t(
										proportional
											? 'aspect-ratio-unlocked'
											: 'aspect-ratio-locked'
									)
								);

								onProportionalChange(!proportional);
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

				{overlay.kind !== 'arrow' && (
					<NumberField
						id="layer-prop-rotation"
						label={t('rotation-degrees')}
						max={360}
						min={-360}
						onCommit={(rotation) => commitPatch({rotation})}
						suffix={t('unit-degrees')}
						value={overlay.rotation ?? 0}
					/>
				)}

				{!pairedWithColor && opacityField}

				{hasBorder(overlay) && (
					<BorderField
						colorLabel={t('border-color')}
						colorValue={overlay.borderColor ?? DEFAULT_BORDER_COLOR}
						id="layer-prop-border-width"
						label={t('border')}
						onColorCommit={(borderColor) =>
							commitPatch({borderColor})
						}
						onColorPreview={(borderColor) =>
							dispatch({
								id: overlay.id,
								patch: {borderColor},
								transient: true,
								type: 'update-overlay',
							})
						}
						onWidthCommit={(borderWidth) =>
							commitPatch({borderWidth})
						}
						widthLabel={t('border-width')}
						widthValue={overlay.borderWidth ?? 0}
					/>
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
