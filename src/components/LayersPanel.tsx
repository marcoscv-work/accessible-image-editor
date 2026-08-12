/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayButtonWithIcon} from '@clayui/button';
import ClayForm, {ClayInput, ClaySelectWithOption} from '@clayui/form';
import React, {useEffect, useRef, useState} from 'react';

import {t} from '../i18n';
import {overlayLabel} from '../imaging/overlayShapes';
import {EditorAction} from '../state/editorReducer';
import {
	Overlay,
	RedactOverlay,
	isBoxOverlay,
} from '../state/types';
import {FONT_FAMILIES} from '../textFonts';
import {EditorSection} from './EditorSection';

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
			onBlur={commit}
			onChange={(event) => setDraft(event.target.value)}
			onKeyDown={(event: React.KeyboardEvent) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					commit();
				}
			}}
			sizing="sm"
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
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						commit();
					}
				}}
				sizing="sm"
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

			<div className="editor-panel-grid">
				{overlay.kind === 'redact' ? (
					<ClayForm.Group>
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
							]}
							sizing="sm"
							value={overlay.level}
						/>
					</ClayForm.Group>
				) : (
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
				)}

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
					<ClayForm.Group>
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

	/**
	 * Roving tabindex (APG): the whole list is a single tab stop, and the
	 * position marks which control carries tabIndex 0. Arrow keys move
	 * it; entering the list lands on the selected layer's name.
	 */
	const [rovingPos, setRovingPos] = useState({column: 0, row: 0});

	const listRef = useRef<HTMLUListElement>(null);

	const selectedRow = items.findIndex(
		(overlay) => overlay.id === selected?.id
	);

	useEffect(() => {
		if (selectedRow >= 0) {
			setRovingPos((pos) =>
				pos.row === selectedRow ? pos : {column: 0, row: selectedRow}
			);
		}
	}, [selectedRow]);

	if (!items.length) {
		return null;
	}

	const handleListKeyDown = (event: React.KeyboardEvent) => {
		const origin = (event.target as Element).closest('[data-row]');

		if (!origin) {
			return;
		}

		let row = Number(origin.getAttribute('data-row'));
		let column = Number(origin.getAttribute('data-column'));

		const lastRow = items.length - 1;
		const lastColumn = 4;

		let horizontal = 0;

		switch (event.key) {
			case 'ArrowDown':
				row = Math.min(row + 1, lastRow);
				break;

			case 'ArrowUp':
				row = Math.max(row - 1, 0);
				break;

			case 'ArrowRight':
				horizontal = 1;
				break;

			case 'ArrowLeft':
				horizontal = -1;
				break;

			case 'End':
				row = lastRow;
				column = 0;
				break;

			case 'Home':
				row = 0;
				column = 0;
				break;

			default:
				return;
		}

		event.preventDefault();
		event.stopPropagation();

		const buttonAt = (targetRow: number, targetColumn: number) =>
			listRef.current?.querySelector<HTMLButtonElement>(
				`[data-row="${targetRow}"][data-column="${targetColumn}"]`
			);

		if (horizontal) {

			// Move within the row, skipping disabled actions.

			let next = column + horizontal;

			while (next >= 0 && next <= lastColumn) {
				if (!buttonAt(row, next)?.disabled) {
					break;
				}

				next += horizontal;
			}

			if (next < 0 || next > lastColumn) {
				return;
			}

			column = next;
		}
		else if (buttonAt(row, column)?.disabled) {
			column = 0;
		}

		const target = buttonAt(row, column);

		if (target) {
			setRovingPos({column, row});

			target.focus();
		}
	};

	const rovingProps = (row: number, column: number) => ({
		'data-column': column,
		'data-row': row,
		onFocus: () => setRovingPos({column, row}),
		tabIndex:
			rovingPos.row === row && rovingPos.column === column ? 0 : -1,
	});

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

	const reorder = (
		overlay: Overlay,
		visualDirection: -1 | 1,
		row?: number
	) => {

		// Visually up (-1) means later in paint order (+1 in the array).

		dispatch({
			direction: visualDirection === -1 ? 1 : -1,
			id: overlay.id,
			type: 'move-overlay-layer',
		});

		// The layer moves to a new row, and the button just used may now
		// be disabled (it reached the end): follow the layer and fall back
		// to its name so focus is never dropped.

		if (row !== undefined) {
			const targetRow = row + visualDirection;
			const column = visualDirection === -1 ? 1 : 2;

			window.setTimeout(() => {
				const list = listRef.current;

				const action = list?.querySelector<HTMLButtonElement>(
					`[data-row="${targetRow}"][data-column="${column}"]`
				);

				const fallback = list?.querySelector<HTMLButtonElement>(
					`[data-row="${targetRow}"][data-column="0"]`
				);

				(action && !action.disabled ? action : fallback)?.focus();
			}, 0);
		}

		onAnnounce(
			t(
				visualDirection === -1 ? 'layer-moved-up' : 'layer-moved-down',
				overlayLabel(overlay)
			)
		);
	};

	return (
		<EditorSection title={t('layers')} titleId="layers-panel-title">

			<span className="sr-only" id="layer-name-description">
				{t('layer-name-description')}
			</span>

			<ul
				className="editor-layer-list list-unstyled small"
				onKeyDown={handleListKeyDown}
				ref={listRef}
			>
				{items.map((overlay, index) => {
					const label = overlayLabel(overlay);
					const isSelected = overlay.id === selected?.id;
					const row = index;

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
								{...rovingProps(row, 0)}
								aria-describedby="layer-name-description"
								aria-pressed={isSelected}
								className="editor-layer-name"
								onClick={() => onSelect(overlay.id)}
								onKeyDown={(event: React.KeyboardEvent) => {
									if (event.key === 'Enter') {

										// Jump to the element on the
										// stage, ready to be moved.

										event.preventDefault();

										onSelect(overlay.id);

										window.setTimeout(() => {
											const node =
												document.querySelector(
													`[data-overlay-id="${overlay.id}"]`
												);

											(
												node as unknown as HTMLElement | null
											)?.focus?.();
										}, 0);
									}
									else if (
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
									{...rovingProps(row, 1)}
									aria-label={t('move-layer-up', label)}
									disabled={index === 0}
									displayType="unstyled"
									onClick={() => reorder(overlay, -1, row)}
									size="xs"
									symbol="angle-up"
									title={t('move-layer-up', label)}
								/>

								<ClayButtonWithIcon
									{...rovingProps(row, 2)}
									aria-label={t('move-layer-down', label)}
									disabled={index === items.length - 1}
									displayType="unstyled"
									onClick={() => reorder(overlay, 1, row)}
									size="xs"
									symbol="angle-down"
									title={t('move-layer-down', label)}
								/>

								<ClayButtonWithIcon
									{...rovingProps(row, 3)}
									aria-label={t('duplicate-layer', label)}
									displayType="unstyled"
									onClick={() => duplicate(overlay)}
									size="xs"
									symbol="copy"
									title={t('duplicate-layer', label)}
								/>

								<ClayButtonWithIcon
									{...rovingProps(row, 4)}
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
		</EditorSection>
	);
}
