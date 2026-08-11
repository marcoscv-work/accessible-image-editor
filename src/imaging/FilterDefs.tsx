import {Adjustments, FilterPreset} from '../state/types';

const PRESET_MATRICES: Partial<Record<FilterPreset, string>> = {
	cool: '0.92 0 0 0 0  0 0.99 0 0 0  0 0 1.08 0 0  0 0 0 1 0',
	invert: '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0',
	noir: '0.2764 0.9298 0.0939 0 -0.15  0.2764 0.9298 0.0939 0 -0.15  0.2764 0.9298 0.0939 0 -0.15  0 0 0 1 0',
	sepia: '0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0',
	vintage: '0.6965 0.3845 0.0945 0 0.03  0.1745 0.843 0.084 0 0.03  0.136 0.267 0.5655 0 0.03  0 0 0 1 0',
	vivid: '1.3148 -0.286 -0.0288 0 0  -0.1676 1.1966 -0.0288 0 0  -0.1676 -0.286 1.4538 0 0  0 0 0 1 0',
	warm: '1.08 0 0 0 0  0 1.02 0 0 0  0 0 0.92 0 0  0 0 0 1 0',
};

export function isIdentityFilter(
	adjustments: Adjustments,
	filter: FilterPreset
): boolean {
	return (
		filter === 'none' &&
		Object.values(adjustments).every((value) => value === 0)
	);
}

/**
 * Per-channel tone curve implementing shadows/highlights: a table transfer
 * function sampled at 17 points. Positive shadows lift the darks (weighted
 * by (1-t)^2), positive highlights push the lights (weighted by t^2).
 */
function toneCurveTable(shadows: number, highlights: number): string {
	const samples: string[] = [];

	for (let i = 0; i <= 16; i++) {
		const input = i / 16;

		const output =
			input +
			0.35 * (shadows / 100) * (1 - input) ** 2 +
			0.35 * (highlights / 100) * input ** 2;

		samples.push(Math.min(1, Math.max(0, output)).toFixed(4));
	}

	return samples.join(' ');
}

interface Props {
	adjustments: Adjustments;
	filter: FilterPreset;
	id: string;
}

/**
 * The single source of truth for the color pipeline. Rendered inside the
 * preview SVG's <defs> and reused verbatim by the export renderer, so the
 * saved image matches the preview by construction.
 */
export function FilterDefs({adjustments, filter, id}: Props) {
	const brightnessSlope = 1 + adjustments.brightness / 100;
	const contrastSlope = 1 + adjustments.contrast / 100;
	const contrastIntercept = 0.5 * (1 - contrastSlope);
	const saturation =
		filter === 'grayscale' ? 0 : 1 + adjustments.saturation / 100;
	const hasToneCurve =
		adjustments.shadows !== 0 || adjustments.highlights !== 0;
	const toneTable = toneCurveTable(
		adjustments.shadows,
		adjustments.highlights
	);
	const presetMatrix = PRESET_MATRICES[filter];

	return (
		<filter colorInterpolationFilters="sRGB" id={id}>
			<feComponentTransfer>
				<feFuncR slope={brightnessSlope} type="linear" />
				<feFuncG slope={brightnessSlope} type="linear" />
				<feFuncB slope={brightnessSlope} type="linear" />
			</feComponentTransfer>

			<feComponentTransfer>
				<feFuncR
					intercept={contrastIntercept}
					slope={contrastSlope}
					type="linear"
				/>
				<feFuncG
					intercept={contrastIntercept}
					slope={contrastSlope}
					type="linear"
				/>
				<feFuncB
					intercept={contrastIntercept}
					slope={contrastSlope}
					type="linear"
				/>
			</feComponentTransfer>

			<feColorMatrix type="saturate" values={String(saturation)} />

			{hasToneCurve && (
				<feComponentTransfer>
					<feFuncR tableValues={toneTable} type="table" />
					<feFuncG tableValues={toneTable} type="table" />
					<feFuncB tableValues={toneTable} type="table" />
				</feComponentTransfer>
			)}

			{presetMatrix && (
				<feColorMatrix type="matrix" values={presetMatrix} />
			)}
		</filter>
	);
}
