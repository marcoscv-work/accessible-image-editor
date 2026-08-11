import ClayButton from '@clayui/button';
import ClayForm, {ClayInput} from '@clayui/form';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {overlayLabel} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {Overlay} from '../state/types';

interface FieldProps {
	id: string;
	label: string;
}

function NumberField({
	id,
	label,
	min = 1,
	onCommit,
	value,
}: FieldProps & {min?: number; onCommit: (value: number) => void; value: number}) {
	const [draft, setDraft] = useState(String(value));

	useEffect(() => setDraft(String(value)), [value]);

	const commit = () => {
		const parsed = Number.parseInt(draft, 10);

		if (Number.isNaN(parsed)) {
			setDraft(String(value));

			return;
		}

		onCommit(Math.max(parsed, min));
	};

	return (
		<ClayForm.Group>
			<label htmlFor={id}>{label}</label>

			<ClayInput
				id={id}
				min={min}
				onBlur={commit}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						commit();
					}
				}}
				type="number"
				value={draft}
			/>
		</ClayForm.Group>
	);
}

function TextField({
	id,
	label,
	onCommit,
	value,
}: FieldProps & {onCommit: (value: string) => void; value: string}) {
	const [draft, setDraft] = useState(value);

	useEffect(() => setDraft(value), [value]);

	const commit = () => {
		if (!draft.trim()) {
			setDraft(value);

			return;
		}

		onCommit(draft.trim());
	};

	return (
		<ClayForm.Group>
			<label htmlFor={id}>{label}</label>

			<ClayInput
				id={id}
				onBlur={commit}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						commit();
					}
				}}
				type="text"
				value={draft}
			/>
		</ClayForm.Group>
	);
}

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
function LayerProperties({dispatch, onAnnounce, overlay}: LayerPropertiesProps) {
	const label = overlayLabel(overlay);

	const colorGesture = useRef(false);

	const commitPatch = (patch: Partial<Overlay>) => {
		dispatch({id: overlay.id, patch, type: 'update-overlay'});

		onAnnounce(t('layer-updated', label));
	};

	return (
		<div
			aria-labelledby="layer-properties-title"
			className="editor-layer-properties"
			role="group"
		>
			<h3 className="editor-panel-subtitle" id="layer-properties-title">
				{t('selected-layer', label)}
			</h3>

			<ClayForm.Group>
				<label htmlFor="layer-prop-color">{t('text-color')}</label>

					<input
						className="editor-color-input form-control"
						id="layer-prop-color"
						onBlur={() => {
							if (colorGesture.current) {
								colorGesture.current = false;

								commitPatch({color: overlay.color});
							}
						}}
						onChange={(event) => {
							colorGesture.current = true;

							dispatch({
								id: overlay.id,
								patch: {color: event.target.value},
								transient: true,
								type: 'update-overlay',
							});
						}}
						type="color"
						value={overlay.color}
					/>
			</ClayForm.Group>

			{overlay.kind === 'text' && (
				<>
					<TextField
						id="layer-prop-text"
						label={t('text-content')}
						onCommit={(text) => commitPatch({text})}
						value={overlay.text}
					/>

					<NumberField
						id="layer-prop-font-size"
						label={t('font-size')}
						min={8}
						onCommit={(fontSize) => commitPatch({fontSize})}
						value={overlay.fontSize}
					/>
				</>
			)}

			{overlay.kind === 'shape' && (
				<div className="editor-panel-grid">
					<NumberField
						id="layer-prop-width"
						label={t('width')}
						onCommit={(width) => commitPatch({width})}
						value={overlay.width}
					/>

					<NumberField
						id="layer-prop-height"
						label={t('height')}
						onCommit={(height) => commitPatch({height})}
						value={overlay.height}
					/>
				</div>
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
		</div>
	);
}

interface Props {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	overlays: Overlay[];
}

/**
 * Layer management as a single-select listbox: arrow keys move the
 * selection, Delete removes the selected layer, and the buttons reorder
 * it. Layers are listed topmost first; the overlays array is painted
 * bottom to top. The selected layer's properties are editable below.
 */
export function LayersPanel({dispatch, onAnnounce, overlays}: Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const items = [...overlays].reverse();

	const selected =
		items.find((overlay) => overlay.id === selectedId) ?? items[0] ?? null;

	const selectByOffset = (offset: number) => {
		if (!selected) {
			return;
		}

		const index = items.findIndex(
			(overlay) => overlay.id === selected.id
		);
		const next = items[index + offset];

		if (next) {
			setSelectedId(next.id);
		}
	};

	const removeSelected = () => {
		if (!selected) {
			return;
		}

		dispatch({id: selected.id, type: 'remove-overlay'});

		onAnnounce(t('annotation-removed', overlayLabel(selected)));

		setSelectedId(null);
	};

	const reorderSelected = (visualDirection: -1 | 1) => {
		if (!selected) {
			return;
		}

		// Visually up (-1) means later in paint order (+1 in the array).

		dispatch({
			direction: visualDirection === -1 ? 1 : -1,
			id: selected.id,
			type: 'move-overlay-layer',
		});

		onAnnounce(
			t(
				visualDirection === -1 ? 'layer-moved-up' : 'layer-moved-down',
				overlayLabel(selected)
			)
		);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectByOffset(1);
				break;

			case 'ArrowUp':
				event.preventDefault();
				selectByOffset(-1);
				break;

			case 'Backspace':
			case 'Delete':
				event.preventDefault();
				removeSelected();
				break;

			default:
				break;
		}
	};

	return (
		<section aria-labelledby="layers-panel-title" className="editor-panel">
			<h2 className="editor-panel-title" id="layers-panel-title">
				{t('layers')}
			</h2>

			{!items.length && (
				<p className="text-secondary">{t('layers-empty')}</p>
			)}

			{items.length > 0 && (
				<>
					<ul
						aria-activedescendant={
							selected ? `layer-${selected.id}` : undefined
						}
						aria-labelledby="layers-panel-title"
						className="editor-layer-list"
						id="layers-listbox"
						onKeyDown={handleKeyDown}
						role="listbox"
						tabIndex={0}
					>
						{items.map((overlay) => (
							<li
								aria-selected={overlay.id === selected?.id}
								className="editor-layer-item"
								id={`layer-${overlay.id}`}
								key={overlay.id}
								onClick={() => setSelectedId(overlay.id)}
								role="option"
							>
								{overlayLabel(overlay)}
							</li>
						))}
					</ul>

					<div className="editor-annotate-actions">
						<ClayButton
							disabled={!selected || items[0] === selected}
							displayType="secondary"
							onClick={() => reorderSelected(-1)}
							size="xs"
						>
							{t('move-up')}
						</ClayButton>

						<ClayButton
							disabled={
								!selected ||
								items[items.length - 1] === selected
							}
							displayType="secondary"
							onClick={() => reorderSelected(1)}
							size="xs"
						>
							{t('move-down')}
						</ClayButton>

						<ClayButton
							disabled={!selected}
							displayType="secondary"
							onClick={removeSelected}
							size="xs"
						>
							{t('delete')}
						</ClayButton>
					</div>

					{selected && (
						<LayerProperties
							dispatch={dispatch}
							key={selected.id}
							onAnnounce={onAnnounce}
							overlay={selected}
						/>
					)}
				</>
			)}
		</section>
	);
}
