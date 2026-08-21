/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

interface Bounds {
	height: number;
	width: number;
	x: number;
	y: number;
}

/**
 * True when the element's focus came from the keyboard (the
 * :focus-visible heuristic). Pointer-driven focus keeps the stage clean;
 * the double ring is reserved for keyboard navigation.
 */
export function matchesFocusVisible(element: Element): boolean {
	try {
		return element.matches(':focus-visible');
	}
	catch {
		return true;
	}
}

export type FocusModality = 'keyboard' | 'pointer';

interface Props {
	bounds: Bounds;

	/**
	 * Keyboard focus gets the full Clay-style double ring; pointer focus
	 * gets a subtle single selection line, enough feedback without the
	 * navigation emphasis.
	 */
	emphasis?: FocusModality;

	/**
	 * Ring geometry: circular nodes (crop handles) get concentric circle
	 * rings; everything else gets rectangles.
	 */
	shape?: 'circle' | 'rectangle';

	/**
	 * CSS pixels per SVG user unit; ring thickness is divided by it so the
	 * ring stays the same size on screen at any zoom level.
	 */
	zoom: number;
}

/**
 * Focus feedback drawn as real SVG geometry: browsers do not reliably
 * render CSS outlines on SVG child elements, so the stage paints its own
 * rings around the focused node. Keyboard focus is a white inner + accent
 * outer pair that stays evident over any image content.
 */
export function FocusRing({
	bounds,
	emphasis = 'keyboard',
	shape = 'rectangle',
	zoom,
}: Props) {
	const thickness = 2 / zoom;
	const gap = 2 / zoom;

	const innerInset = gap + thickness / 2;
	const outerInset = gap + thickness * 1.5;

	if (emphasis === 'pointer') {
		const selectionThickness = 1.5 / zoom;
		const inset = gap + selectionThickness / 2;

		if (shape === 'circle') {
			return (
				<circle
					className="selection-ring"
					cx={bounds.x + bounds.width / 2}
					cy={bounds.y + bounds.height / 2}
					fill="none"
					pointerEvents="none"
					r={Math.max(bounds.width, bounds.height) / 2 + inset}
					strokeWidth={selectionThickness}
				/>
			);
		}

		return (
			<rect
				className="selection-ring"
				fill="none"
				height={bounds.height + 2 * inset}
				pointerEvents="none"
				strokeWidth={selectionThickness}
				width={bounds.width + 2 * inset}
				x={bounds.x - inset}
				y={bounds.y - inset}
			/>
		);
	}

	if (shape === 'circle') {
		const cx = bounds.x + bounds.width / 2;
		const cy = bounds.y + bounds.height / 2;
		const radius = Math.max(bounds.width, bounds.height) / 2;

		return (
			<g pointerEvents="none">
				<circle
					className="focus-ring-outer"
					cx={cx}
					cy={cy}
					fill="none"
					r={radius + outerInset}
					strokeWidth={thickness}
				/>

				<circle
					className="focus-ring-inner"
					cx={cx}
					cy={cy}
					fill="none"
					r={radius + innerInset}
					strokeWidth={thickness}
				/>
			</g>
		);
	}

	return (
		<g pointerEvents="none">
			<rect
				className="focus-ring-outer"
				fill="none"
				height={bounds.height + 2 * outerInset}
				strokeWidth={thickness}
				width={bounds.width + 2 * outerInset}
				x={bounds.x - outerInset}
				y={bounds.y - outerInset}
			/>

			<rect
				className="focus-ring-inner"
				fill="none"
				height={bounds.height + 2 * innerInset}
				strokeWidth={thickness}
				width={bounds.width + 2 * innerInset}
				x={bounds.x - innerInset}
				y={bounds.y - innerInset}
			/>
		</g>
	);
}
