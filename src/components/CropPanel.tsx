/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayButtonWithIcon} from '@clayui/button';
import ClayForm, {ClayInput} from '@clayui/form';
import ClaySlider from '@clayui/slider';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {CropRect} from '../state/types';
import {EditorSection} from './EditorSection';

interface Props {
	angle: number;
	crop: CropRect;
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
}

type Field = 'height' | 'width' | 'x' | 'y';

const FIELD_LABELS: Record<Field, string> = {
	height: 'height',
	width: 'width',
	x: 'x-position',
	y: 'y-position',
};

/**
 * The non-spatial route to precise cropping: plain numeric inputs. Values
 * commit on blur or Enter so screen reader and keyboard users can type a
 * full number without fighting live clamping. The aspect ratio lock is a
 * padlock toggle between Width and Height, drawing-tool style.
 */
export function CropPanel({angle, crop, dispatch, onAnnounce}: Props) {
	const [drafts, setDrafts] = useState<Record<Field, string>>({
		height: String(crop.height),
		width: String(crop.width),
		x: String(crop.x),
		y: String(crop.y),
	});

	const [aspectLocked, setAspectLocked] = useState(false);

	const angleGesture = useRef(false);

	const commitAngle = () => {
		if (!angleGesture.current) {
			return;
		}

		angleGesture.current = false;

		dispatch({angle, type: 'set-angle'});

		onAnnounce(t('angle-set', angle));
	};

	useEffect(() => {
		setDrafts({
			height: String(crop.height),
			width: String(crop.width),
			x: String(crop.x),
			y: String(crop.y),
		});
	}, [crop]);

	const commit = (field: Field) => {
		const value = Number.parseInt(drafts[field], 10);

		if (Number.isNaN(value)) {
			setDrafts((previous) => ({
				...previous,
				[field]: String(crop[field]),
			}));

			return;
		}

		const next: CropRect = {...crop, [field]: value};

		if (aspectLocked && crop.height > 0) {
			const aspect = crop.width / crop.height;

			if (field === 'width') {
				next.height = Math.round(value / aspect);
			}
			else if (field === 'height') {
				next.width = Math.round(value * aspect);
			}
		}

		if (
			next.height === crop.height &&
			next.width === crop.width &&
			next.x === crop.x &&
			next.y === crop.y
		) {
			return;
		}

		dispatch({crop: next, type: 'set-crop'});

		onAnnounce(
			t('crop-applied', next.x, next.y, next.width, next.height)
		);
	};

	const renderField = (field: Field) => (
		<ClayForm.Group key={field} small>
			<label htmlFor={`crop-${field}`}>{t(FIELD_LABELS[field])}</label>

			<ClayInput
				id={`crop-${field}`}
				min={0}
				onBlur={() => commit(field)}
				onChange={(event) =>
					setDrafts((previous) => ({
						...previous,
						[field]: event.target.value,
					}))
				}
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						commit(field);
					}
				}}
				sizing="sm"
				type="number"
				value={drafts[field]}
			/>
		</ClayForm.Group>
	);

	return (
		<EditorSection
			title={t('crop-and-rotation')}
			titleId="crop-panel-title"
		>

			<div className="editor-panel-grid">
				{renderField('x')}
				{renderField('y')}
			</div>

			<div className="editor-crop-size-row">
				{renderField('width')}

				<ClayButtonWithIcon
					aria-label={t('aspect-lock')}
					aria-pressed={aspectLocked}
					className="editor-aspect-lock"
					displayType="unstyled"
					onClick={() => {
						setAspectLocked((locked) => {
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
					symbol={aspectLocked ? 'lock' : 'unlock'}
					title={t('aspect-lock')}
				/>

				{renderField('height')}
			</div>

			<ClayForm.Group small>
				<div className="editor-slider-row">
					<label htmlFor="crop-angle">{t('straighten')}</label>

					<span aria-hidden="true" className="editor-slider-value">
						{angle}&deg;
					</span>

					{angle !== 0 && (
						<ClayButtonWithIcon
							aria-label={t('reset-angle')}
							className="editor-slider-reset"
							displayType="unstyled"
							onClick={() => {
								dispatch({angle: 0, type: 'set-angle'});
								onAnnounce(t('angle-set', 0));
							}}
							size="xs"
							symbol="restore"
							title={t('reset-angle')}
						/>
					)}
				</div>

				<ClaySlider
					id="crop-angle"
					max={45}
					min={-45}
					onBlur={commitAngle}
					onChange={(next: number) => {
						angleGesture.current = true;

						dispatch({
							angle: next,
							transient: true,
							type: 'set-angle',
						});
					}}
					onKeyDown={(event: React.KeyboardEvent) => {

						// Shift steps by 10, as everywhere else.

						if (!event.shiftKey) {
							return;
						}

						const delta =
							event.key === 'ArrowRight' || event.key === 'ArrowUp'
								? 10
								: event.key === 'ArrowLeft' ||
									  event.key === 'ArrowDown'
									? -10
									: 0;

						if (!delta) {
							return;
						}

						event.preventDefault();

						angleGesture.current = true;

						dispatch({
							angle: Math.max(-45, Math.min(45, angle + delta)),
							transient: true,
							type: 'set-angle',
						});
					}}
					onKeyUp={commitAngle}
					onPointerUp={commitAngle}
					showTooltip={false}
					value={angle}
				/>
			</ClayForm.Group>
		</EditorSection>
	);
}
