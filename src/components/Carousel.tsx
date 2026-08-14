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

	const [scroll, setScroll] = useState({
		left: false,
		overflows: false,
		right: false,
	});

	const updateScroll = useCallback(() => {
		const element = trackRef.current;

		if (!element) {
			return;
		}

		// Only a track the layout actually made scrollable can overflow:
		// above the breakpoint these tracks are a grid, or they wrap, and
		// nothing is ever off screen.

		const overflows =
			getComputedStyle(element).overflowX === 'auto' &&
			element.scrollWidth > element.clientWidth + 4;

		const left = element.scrollLeft > 4;
		const right =
			element.scrollLeft + element.clientWidth < element.scrollWidth - 4;

		// Bail on an unchanged set: a fresh object would re-render for
		// nothing on every scroll event.

		setScroll((current) =>
			current.left === left &&
			current.overflows === overflows &&
			current.right === right
				? current
				: {left, overflows, right}
		);
	}, []);

	useEffect(() => {
		updateScroll();

		// The track is observed rather than the window: it also resizes when
		// its section is expanded, which is when a collapsed panel finally
		// has a width to measure.

		const observer = new ResizeObserver(updateScroll);

		if (trackRef.current) {
			observer.observe(trackRef.current);
		}

		return () => observer.disconnect();
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
			{scroll.overflows && (
				<ClayButtonWithIcon
					aria-hidden="true"
					borderless
					className="editor-carousel-arrow"
					disabled={!scroll.left}
				displayType="secondary"
					onClick={() => scrollByPage(-1)}
					size="sm"
					symbol="angle-left"
					tabIndex={-1}
				/>
			)}

			<div
				{...trackProps}
				className={`editor-carousel-track ${className}`}
				onScroll={updateScroll}
				ref={trackRef}
			>
				{children}
			</div>

			{scroll.overflows && (
				<ClayButtonWithIcon
					aria-hidden="true"
					borderless
					className="editor-carousel-arrow"
					disabled={!scroll.right}
					displayType="secondary"
					onClick={() => scrollByPage(1)}
					size="sm"
					symbol="angle-right"
					tabIndex={-1}
				/>
			)}
		</div>
	);
}
