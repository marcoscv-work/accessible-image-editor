/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayForm, {ClayInput} from '@clayui/form';
import ClaySlider from '@clayui/slider';
import React, {useEffect, useRef, useState} from 'react';

/**
 * The sidebar's form controls. Every one of them is a labelled Clay input
 * that edits a draft and commits on Enter or on blur, because a value
 * dispatched on every keystroke would fill the history with the states a
 * number passes through on its way to being typed.
 */

interface FieldProps {
	id: string;
	label: string;
}

/**
 * Commits on Enter and on blur, and puts the last good value back when
 * what was typed is not a number.
 */
export function NumberField({
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
		<ClayForm.Group small>
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

/**
 * The same contract for text, refusing to commit an empty value: a text
 * annotation with nothing in it would be an annotation nobody can find.
 */
export function TextField({
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
		<ClayForm.Group small>
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

/**
 * A native colour input, which reports every step of a drag through the
 * picker. The intermediate values are dispatched as transient so the
 * preview follows the pointer, and the one that lands is committed on
 * blur as a single history entry.
 */
export function ColorField({
	id,
	label,
	onCommit,
	onPreview,
	value,
}: FieldProps & {
	onCommit: (value: string) => void;
	onPreview: (value: string) => void;
	value: string;
}) {
	// A ref rather than state: the preview already re-renders on every
	// step, and a flag that only the blur handler reads has no business
	// scheduling renders of its own.

	const dragging = useRef(false);

	return (
		<ClayForm.Group small>
			<label htmlFor={id}>{label}</label>

			<input
				className="editor-color-input form-control form-control-sm"
				id={id}
				onBlur={() => {
					if (dragging.current) {
						dragging.current = false;

						onCommit(value);
					}
				}}
				onChange={(event) => {
					dragging.current = true;

					onPreview(event.target.value);
				}}
				type="color"
				value={value}
			/>
		</ClayForm.Group>
	);
}

/**
 * A slider whose drag is one history entry. Every step is reported as a
 * preview so the stage follows the control, and the value that the
 * gesture lands on is committed once, when the pointer or the key is
 * released, or when focus leaves.
 */
export function CommitSlider({
	children,
	id,
	label,
	max,
	min,
	onCommit,
	onPreview,
	shiftStep,
	value,
	valueLabel,
}: FieldProps & {
	children?: React.ReactNode;
	max: number;
	min: number;
	onCommit: (value: number) => void;
	onPreview: (value: number) => void;
	shiftStep?: number;
	value: number;
	valueLabel: string;
}) {
	const dragging = useRef(false);

	const commit = () => {
		if (!dragging.current) {
			return;
		}

		dragging.current = false;

		onCommit(value);
	};

	return (
		<ClayForm.Group small>
			<div className="editor-slider-row">
				<label htmlFor={id}>{label}</label>

				<span aria-hidden="true" className="editor-slider-value">
					{valueLabel}
				</span>

				{children}
			</div>

			<ClaySlider
				id={id}
				max={max}
				min={min}
				onBlur={commit}
				onChange={(next: number) => {
					dragging.current = true;

					onPreview(next);
				}}
				onKeyDown={(event: React.KeyboardEvent) => {

					// Native ranges step by one; Shift takes the larger
					// stride, for sliders that ask for one.

					if (!shiftStep || !event.shiftKey) {
						return;
					}

					const delta =
						event.key === 'ArrowRight' || event.key === 'ArrowUp'
							? shiftStep
							: event.key === 'ArrowLeft' ||
								  event.key === 'ArrowDown'
								? -shiftStep
								: 0;

					if (!delta) {
						return;
					}

					event.preventDefault();

					dragging.current = true;

					onPreview(Math.max(min, Math.min(max, value + delta)));
				}}
				onKeyUp={commit}
				onPointerUp={commit}
				showTooltip={false}
				value={value}
			/>
		</ClayForm.Group>
	);
}
