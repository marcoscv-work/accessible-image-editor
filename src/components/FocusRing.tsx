interface Bounds {
	height: number;
	width: number;
	x: number;
	y: number;
}

interface Props {
	bounds: Bounds;

	/**
	 * CSS pixels per SVG user unit; ring thickness is divided by it so the
	 * ring stays the same size on screen at any zoom level.
	 */
	zoom: number;
}

/**
 * Clay-style double focus ring, drawn as real SVG geometry: browsers do
 * not reliably render CSS outlines on SVG child elements, so the stage
 * paints its own white inner + accent outer rings around the focused
 * node. The two-tone pair stays evident over any image content.
 */
export function FocusRing({bounds, zoom}: Props) {
	const thickness = 3 / zoom;
	const gap = 2 / zoom;

	const innerInset = gap + thickness / 2;
	const outerInset = gap + thickness * 1.5;

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
