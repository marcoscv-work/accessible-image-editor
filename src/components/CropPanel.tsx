import ClayForm, {ClayCheckbox, ClayInput} from '@clayui/form';
import React, {useEffect, useState} from 'react';

import {t} from '../i18n';
import {EditorAction} from '../state/editorReducer';
import {CropRect} from '../state/types';

interface Props {
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
 * full number without fighting live clamping.
 */
export function CropPanel({crop, dispatch, onAnnounce}: Props) {
	const [drafts, setDrafts] = useState<Record<Field, string>>({
		height: String(crop.height),
		width: String(crop.width),
		x: String(crop.x),
		y: String(crop.y),
	});

	const [aspectLocked, setAspectLocked] = useState(false);

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

		dispatch({crop: next, type: 'set-crop'});

		onAnnounce(
			t('crop-applied', next.x, next.y, next.width, next.height)
		);
	};

	return (
		<section aria-labelledby="crop-panel-title" className="editor-panel">
			<h2 className="editor-panel-title" id="crop-panel-title">
				{t('crop')}
			</h2>

			<div className="editor-panel-grid">
				{(Object.keys(FIELD_LABELS) as Field[]).map((field) => (
					<ClayForm.Group key={field}>
						<label htmlFor={`crop-${field}`}>
							{t(FIELD_LABELS[field])}
						</label>

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
							type="number"
							value={drafts[field]}
						/>
					</ClayForm.Group>
				))}
			</div>

			<ClayCheckbox
				checked={aspectLocked}
				label={t('aspect-lock')}
				onChange={() => setAspectLocked((locked) => !locked)}
			/>
		</section>
	);
}
