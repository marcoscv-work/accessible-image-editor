/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import React from 'react';

import {Carousel} from './Carousel';

interface Props<T extends string> {

	/**
	 * Prefix for the option ids, and the radio group's name: `filter`
	 * gives `filter-sepia` inside the group `filter-preset`.
	 */
	idPrefix: string;

	items: T[];
	label: (item: T) => string;
	legend: string;
	onSelect: (item: T) => void;

	/**
	 * The card's picture, drawn by whatever the preset is a preset of.
	 */
	preview: (item: T) => React.ReactNode;

	selected: T;
}

/**
 * A gallery of mutually exclusive presets: a native radio group whose
 * inputs are visually hidden but fully present, so the group keeps its
 * semantics and its arrow-key behaviour while the card does the talking.
 * Selection is shown with a ring, a bold label and a check badge, never
 * by colour alone.
 *
 * Filters and frames are the same interaction with different pictures on
 * the cards, so they are the same component with different pictures on
 * the cards.
 */
export function PresetGallery<T extends string>({
	idPrefix,
	items,
	label,
	legend,
	onSelect,
	preview,
	selected,
}: Props<T>) {
	return (
		<fieldset>
			<legend className="sr-only">{legend}</legend>

			{/*
			  * Below the sidebar breakpoint the cards become a single
			  * swipeable row.
			  */}
			<Carousel className="editor-preset-grid" itemCount={items.length}>
				{items.map((item) => {
					const name = label(item);

					return (
						<div
							className="custom-control custom-radio editor-preset-option"
							key={item}
						>
							<input
								checked={selected === item}
								className="editor-preset-input sr-only"
								id={`${idPrefix}-${item}`}
								name={`${idPrefix}-preset`}
								onChange={() => onSelect(item)}
								type="radio"
								value={item}
							/>

							<label
								className="editor-preset-label"
								htmlFor={`${idPrefix}-${item}`}
							>
								<span className="editor-preset-card">
									{preview(item)}
								</span>

								<span className="editor-preset-name">
									{name}
								</span>
							</label>
						</div>
					);
				})}
			</Carousel>
		</fieldset>
	);
}
