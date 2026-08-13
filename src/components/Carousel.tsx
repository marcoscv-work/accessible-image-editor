/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {ClayButtonWithIcon} from '@clayui/button';
import React, {useCallback, useEffect, useRef, useState} from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;

	/**
	 * Layout class for the track, which keeps its own grid or flex rules.
	 * The carousel only adds the horizontal scrolling behaviour.
	 */
	className: string;

	/**
	 * How many items the track holds, so the arrows are re-evaluated when
	 * the configuration offers a different set.
	 */
	itemCount: number;
}

/**
 * A track that becomes one swipeable row in the stacked layout, with
 * arrows that page through it.
 *
 * The arrows are a pointer affordance only: they are hidden from assistive
 * technology and kept out of the tab order, because every track using this
 * is already a keyboard-navigable group (a radio group, or a roving
 * tabindex), and the browser scrolls the focused child into view on its
 * own. Exposing them would add redundant stops that reach nothing new.
 */
export function Carousel({
	children,
	className,
	itemCount,
	...trackProps
}: Props) {
	const trackRef = useRef<HTMLDivElement>(null);

	const [canScroll, setCanScroll] = useState({left: false, right: false});

	const updateScroll = useCallback(() => {
		const element = trackRef.current;

		if (!element) {
			return;
		}

		const left = element.scrollLeft > 4;
		const right =
			element.scrollLeft + element.clientWidth < element.scrollWidth - 4;

		// Bail on an unchanged pair: the effect below runs on every set
		// change, and a fresh object would re-render for nothing.

		setCanScroll((current) =>
			current.left === left && current.right === right
				? current
				: {left, right}
		);
	}, []);

	useEffect(() => {
		updateScroll();

		window.addEventListener('resize', updateScroll);

		return () => window.removeEventListener('resize', updateScroll);
	}, [itemCount, updateScroll]);

	const scrollByPage = (direction: -1 | 1) => {
		const element = trackRef.current;

		element?.scrollBy({
			behavior: 'smooth',
			left: direction * element.clientWidth * 0.8,
		});
	};

	return (
		<div className="editor-carousel">
			<ClayButtonWithIcon
				aria-hidden="true"
				className="border-0 editor-carousel-arrow"
				disabled={!canScroll.left}
				displayType="secondary"
				onClick={() => scrollByPage(-1)}
				size="sm"
				symbol="angle-left"
				tabIndex={-1}
			/>

			<div
				{...trackProps}
				className={`editor-carousel-track ${className}`}
				onScroll={updateScroll}
				ref={trackRef}
			>
				{children}
			</div>

			<ClayButtonWithIcon
				aria-hidden="true"
				className="border-0 editor-carousel-arrow"
				disabled={!canScroll.right}
				displayType="secondary"
				onClick={() => scrollByPage(1)}
				size="sm"
				symbol="angle-right"
				tabIndex={-1}
			/>
		</div>
	);
}
