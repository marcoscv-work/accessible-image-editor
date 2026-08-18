/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayInput} from '@clayui/form';
import React, {useMemo, useRef, useState} from 'react';

import {EMOJI, EmojiEntry} from '../emojiData';
import {t} from '../i18n';

const COLUMNS = 8;

/**
 * The names, lowercased once. Unicode capitalises plenty of them ("flag:
 * Spain", "ATM sign", "Aquarius"), so comparing a lowercased query against
 * the names as written finds nothing for exactly the words people type.
 * Built once at module scope rather than per keystroke.
 */
const SEARCH_KEYS = EMOJI.map((entry) => entry.n.toLowerCase());

/**
 * What the picker offers before anyone types: seven rows of the emoji
 * people actually reach for, which are faces first, then hearts and hands,
 * and only then the handful of marks that earn their place on a picture.
 * Nineteen hundred cells is an inventory rather than a choice, so the full
 * set is what searching is for.
 */
const COMMON = [
	'😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍',
	'🥰', '😘', '😎', '🤩', '🤔', '🙃', '😅', '😂',
	'🥲', '😢', '😭', '😡', '🤯', '😱', '😴', '🥺',
	'🤗', '🤭', '🙄', '😬', '😳', '🥳', '🤠', '😇',
	'❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
	'💕', '💖', '💯', '👍', '👎', '👏', '🙌', '🙏',
	'👀', '✅', '❌', '⚠️', '⭐', '🔥', '🎉', '🚀',
];

const BY_CHARACTER = new Map(EMOJI.map((entry) => [entry.c, entry]));

/**
 * The common set as full entries, so its cells carry Unicode's own names
 * exactly as the searched ones do. Anything the list names that the data
 * does not have is dropped rather than shown without a name.
 */
const COMMON_ENTRIES = COMMON.map((character) =>
	BY_CHARACTER.get(character)
).filter(Boolean) as EmojiEntry[];

/**
 * How many cells are built at once. Nineteen hundred glyphs would be
 * nineteen hundred DOM nodes for a list nobody scrolls to the end of, so
 * the grid renders a window and extends it as the popover is scrolled.
 */
const PAGE = 96;

interface Props {
	onChoose: (emoji: EmojiEntry) => void;
}

/**
 * The whole standard emoji set, as characters. Nothing is bundled: the
 * cell holds the character and the platform draws it, which is why this
 * costs no assets and covers everything Unicode has.
 *
 * Searching is over Unicode's own names, which are also the accessible
 * names and the tooltips, so what someone types is what they heard.
 */
export function EmojiPicker({onChoose}: Props) {
	const [query, setQuery] = useState('');

	const [limit, setLimit] = useState(PAGE);

	const gridRef = useRef<HTMLDivElement>(null);

	// Filtering 1,900 short strings is nothing; building their cells is
	// what costs, so the work that is memoised is the match list and the
	// work that is bounded is the render.

	const searching = Boolean(query.trim());

	const matches = useMemo(() => {
		const needle = query.trim().toLowerCase();

		if (!needle) {
			return COMMON_ENTRIES;
		}

		const words = needle.split(/\s+/);

		return EMOJI.filter((_, index) => {
			const name = SEARCH_KEYS[index];

			return words.every((word) => name.includes(word));
		});
	}, [query]);

	const shown = matches.slice(0, limit);

	const rows: EmojiEntry[][] = [];

	for (let index = 0; index < shown.length; index += COLUMNS) {
		rows.push(shown.slice(index, index + COLUMNS));
	}

	const move = (index: number) => {
		const cells =
			gridRef.current?.querySelectorAll<HTMLButtonElement>('button');

		if (!cells?.length) {
			return;
		}

		cells[Math.min(Math.max(index, 0), cells.length - 1)]?.focus();
	};

	const handleGridKeyDown = (event: React.KeyboardEvent) => {
		const index = Number(
			(event.target as Element)
				.closest('[data-cell]')
				?.getAttribute('data-cell')
		);

		if (Number.isNaN(index)) {
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				move(index + COLUMNS);
				break;

			case 'ArrowLeft':
				move(index - 1);
				break;

			case 'ArrowRight':
				move(index + 1);
				break;

			case 'ArrowUp':

				// From the top row, back to the search field rather than
				// out of the popover.

				if (index < COLUMNS) {
					gridRef.current
						?.closest('.editor-emoji-picker')
						?.querySelector<HTMLInputElement>('input')
						?.focus();

					break;
				}

				move(index - COLUMNS);
				break;

			case 'End':
				move(shown.length - 1);
				break;

			case 'Home':
				move(0);
				break;

			default:
				return;
		}

		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<div className="editor-emoji-picker">
			<div className="editor-emoji-header">
				<ClayInput

				/*
				 * A placeholder is not a name: it disappears the moment
				 * anything is typed, and axe is right to refuse it as the
				 * only label a control has.
				 */
				aria-describedby="emoji-search-count"
				aria-label={t('emoji-search')}
				autoFocus
				id="emoji-search"
				onChange={(event) => {
					setQuery(event.target.value);

					// A new search starts a new window, or the previous
					// one would decide how much of this one is visible.

					setLimit(PAGE);
				}}
				onKeyDown={(event: React.KeyboardEvent) => {
					if (event.key === 'ArrowDown') {

						// Stopped as well as claimed: Clay's menu walks
						// focus on the same key, and letting the event
						// bubble had it advance one further past the cell
						// this handler chose.

						event.preventDefault();
						event.stopPropagation();

						move(0);
					}
				}}
				placeholder={t('emoji-search')}
				sizing="sm"
				type="search"
				value={query}
			/>

			{/*
			  * Announced rather than only shown: someone searching by name
			  * needs to know the list narrowed, and by how much.
			  */}
			<div
				className="editor-emoji-count"
				id="emoji-search-count"
				role="status"
			>
				{searching
					? t('emoji-count', matches.length)
					: t('emoji-common', EMOJI.length)}
			</div>

			</div>

			{!matches.length && (
				<div className="editor-emoji-grid">
					<p className="editor-emoji-empty">
						{t('emoji-none', query.trim())}
					</p>
				</div>
			)}

			<div
				aria-label={t('add-emoji')}
				className="editor-emoji-grid editor-menu-grid"
				hidden={!matches.length}
				onKeyDown={handleGridKeyDown}
				onScroll={(event) => {
					const box = event.currentTarget;

					if (
						box.scrollTop + box.clientHeight >=
							box.scrollHeight - 64 &&
						limit < matches.length
					) {
						setLimit((current) => current + PAGE);
					}
				}}
				ref={gridRef}
				role="grid"
			>
				{rows.map((row, rowIndex) => (
					<div className="editor-emoji-row" key={rowIndex} role="row">
						{row.map((entry, columnIndex) => {
							const index = rowIndex * COLUMNS + columnIndex;

							return (
								<span key={entry.c} role="gridcell">
									<button
										aria-label={entry.n}
										className="btn editor-emoji-cell editor-menu-cell"
										data-cell={index}
										onClick={() => onChoose(entry)}
										tabIndex={index === 0 ? 0 : -1}
										title={entry.n}
										type="button"
									>
										{entry.c}
									</button>
								</span>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
