import {ClayButtonWithIcon} from '@clayui/button';
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
	max,
	min = 1,
	onCommit,
	suffix,
	value,
}: FieldProps & {
	max?: number;
	min?: number;
	onCommit: (value: number) => void;
	suffix?: string;
	value: number;
}) {
	const [draft, setDraft] = useState(String(value));

	useEffect(() => setDraft(String(value)), [value]);

	const commit = () => {
		const parsed = Number.parseInt(draft, 10);

		if (Number.isNaN(parsed)) {
			setDraft(String(value));

			return;
		}

		onCommit(Math.min(Math.max(parsed, min), max ?? Infinity));
	};

	const input = (
		<ClayInput
			id={id}
			max={max}
			min={min}
			sizing="sm"
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
	);

	return (
		<ClayForm.Group>
			<label htmlFor={id}>{label}</label>

			{suffix ? (
				<ClayInput.Group small>
					<ClayInput.GroupItem prepend>{input}</ClayInput.GroupItem>

					<ClayInput.GroupItem append shrink>
						<ClayInput.GroupText>{suffix}</ClayInput.GroupText>
					</ClayInput.GroupItem>
				</ClayInput.Group>
			) : (
				input
			)}
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
				sizing="sm"
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

			{overlay.kind === 'text' && (
				<TextField
					id="layer-prop-text"
					label={t('text-content')}
					onCommit={(text) => commitPatch({text})}
					value={overlay.text}
				/>
			)}

			<div className="editor-panel-grid">
				<ClayForm.Group>
					<label htmlFor="layer-prop-color">
						{t('text-color')}
					</label>

					<input
						className="editor-color-input form-control form-control-sm"
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

				<NumberField
					id="layer-prop-opacity"
					label={t('opacity')}
					max={100}
					min={0}
					onCommit={(opacity) => commitPatch({opacity})}
					suffix="%"
					value={overlay.opacity ?? 100}
				/>

				<NumberField
					id="layer-prop-rotation"
					label={t('rotation-degrees')}
					max={360}
					min={-360}
					onCommit={(rotation) => commitPatch({rotation})}
					suffix="°"
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
					<NumberField
						id="layer-prop-font-size"
						label={t('font-size')}
						min={8}
						onCommit={(fontSize) => commitPatch({fontSize})}
						value={overlay.fontSize}
					/>
				)}

				{overlay.kind === 'shape' && (
					<>
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
					</>
				)}
			</div>
		</div>
	);
}

interface Props {
	dispatch: (action: EditorAction) => void;
	onAnnounce: (message: string) => void;
	onSelect: (id: string | null) => void;
	overlays: Overlay[];
	selectedId: string | null;
}

/**
 * Layer management: one row per layer, topmost first (the overlays array
 * is painted bottom to top). The row's name button selects the layer for
 * the properties editor below; per-row icon actions (reorder, delete)
 * reveal on hover or keyboard focus and carry the layer name in their
 * accessible names. The panel disappears while there are no annotations.
 */
export function LayersPanel({
	dispatch,
	onAnnounce,
	onSelect,
	overlays,
	selectedId,
}: Props) {
	const items = [...overlays].reverse();

	const selected =
		items.find((overlay) => overlay.id === selectedId) ?? items[0] ?? null;

	if (!items.length) {
		return null;
	}

	const remove = (overlay: Overlay) => {
		dispatch({id: overlay.id, type: 'remove-overlay'});

		onAnnounce(t('annotation-removed', overlayLabel(overlay)));

		onSelect(null);
	};

	const duplicate = (overlay: Overlay) => {
		const newId = `${overlay.kind}-${crypto.randomUUID().slice(0, 8)}`;

		dispatch({id: overlay.id, newId, type: 'duplicate-overlay'});

		onAnnounce(t('annotation-duplicated', overlayLabel(overlay)));

		onSelect(newId);
	};

	const reorder = (overlay: Overlay, visualDirection: -1 | 1) => {

		// Visually up (-1) means later in paint order (+1 in the array).

		dispatch({
			direction: visualDirection === -1 ? 1 : -1,
			id: overlay.id,
			type: 'move-overlay-layer',
		});

		onAnnounce(
			t(
				visualDirection === -1 ? 'layer-moved-up' : 'layer-moved-down',
				overlayLabel(overlay)
			)
		);
	};

	return (
		<section aria-labelledby="layers-panel-title" className="editor-panel">
			<h2 className="editor-panel-title" id="layers-panel-title">
				{t('layers')}
			</h2>

			<ul className="editor-layer-list list-unstyled small">
				{items.map((overlay, index) => {
					const label = overlayLabel(overlay);
					const isSelected = overlay.id === selected?.id;

					return (
						<li
							className={
								isSelected
									? 'editor-layer-item editor-layer-item-selected'
									: 'editor-layer-item'
							}
							key={overlay.id}
						>
							<button
								aria-pressed={isSelected}
								className="editor-layer-name"
								onClick={() => onSelect(overlay.id)}
								onKeyDown={(event: React.KeyboardEvent) => {
									if (
										event.key === 'Delete' ||
										event.key === 'Backspace'
									) {
										event.preventDefault();
										remove(overlay);
									}
								}}
								type="button"
							>
								{label}
							</button>

							<span className="editor-layer-actions">
								<ClayButtonWithIcon
									aria-label={t('move-layer-up', label)}
									disabled={index === 0}
									displayType="unstyled"
									onClick={() => reorder(overlay, -1)}
									size="xs"
									symbol="angle-up"
									title={t('move-layer-up', label)}
								/>

								<ClayButtonWithIcon
									aria-label={t('move-layer-down', label)}
									disabled={index === items.length - 1}
									displayType="unstyled"
									onClick={() => reorder(overlay, 1)}
									size="xs"
									symbol="angle-down"
									title={t('move-layer-down', label)}
								/>

								<ClayButtonWithIcon
									aria-label={t('duplicate-layer', label)}
									displayType="unstyled"
									onClick={() => duplicate(overlay)}
									size="xs"
									symbol="copy"
									title={t('duplicate-layer', label)}
								/>

								<ClayButtonWithIcon
									aria-label={t('delete-layer', label)}
									displayType="unstyled"
									onClick={() => remove(overlay)}
									size="xs"
									symbol="trash"
									title={t('delete-layer', label)}
								/>
							</span>
						</li>
					);
				})}
			</ul>

			{selected && (
				<LayerProperties
					dispatch={dispatch}
					key={selected.id}
					onAnnounce={onAnnounce}
					overlay={selected}
				/>
			)}
		</section>
	);
}
