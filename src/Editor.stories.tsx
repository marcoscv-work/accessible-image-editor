/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {EditorStory} from './EditorStory';
import {
	ADJUSTMENT_KEYS,
	ANNOTATE_TOOLS,
	AdjustmentKey,
	AnnotateTool,
	RATIO_PRESETS,
} from './editorConfig';
import {FILTER_PRESETS} from './imaging/FilterDefs';
import {FRAME_KINDS} from './imaging/frameShapes';
import {
	FilterPreset,
	FrameKind,
	RatioPreset,
} from './state/types';

import type {Meta, StoryObj} from '@storybook/react-vite';

/**
 * The story exposes the configuration as flat controls, which is the only
 * way to combine sections, tools and presets live from the toolbar.
 */
interface StoryArgs {
	adjustments: AdjustmentKey[];
	annotate: AnnotateTool[];
	crop: boolean;
	filters: FilterPreset[];
	frames: FrameKind[];
	ratios: RatioPreset[];
	rotate: boolean;
	straighten: boolean;
}

const meta: Meta<StoryArgs> = {
	argTypes: {
		adjustments: {control: 'check', options: ADJUSTMENT_KEYS},
		annotate: {control: 'check', options: ANNOTATE_TOOLS},
		crop: {control: 'boolean'},
		filters: {control: 'check', options: FILTER_PRESETS},
		frames: {control: 'check', options: FRAME_KINDS},
		ratios: {control: 'check', options: RATIO_PRESETS},
		rotate: {control: 'boolean'},
		straighten: {control: 'boolean'},
	},
	args: {
		adjustments: ADJUSTMENT_KEYS,
		annotate: ANNOTATE_TOOLS,
		crop: true,
		filters: FILTER_PRESETS,
		frames: FRAME_KINDS,
		ratios: RATIO_PRESETS,
		rotate: true,
		straighten: true,
	},
	render: ({
		adjustments,
		annotate,
		crop,
		filters,
		frames,
		ratios,
		rotate,
			straighten,
	}) => (
		<EditorStory
			config={{
				adjustments: adjustments.length ? {sliders: adjustments} : false,
				annotate: annotate.length ? {tools: annotate} : false,
				crop: crop ? {ratios, rotate, straighten} : false,
				filters: filters.length ? {presets: filters} : false,
				frames: frames.length ? {presets: frames} : false,
			}}
		/>
	),
	title: 'Accessible Image Editor',
};

export default meta;

type Story = StoryObj<StoryArgs>;

/**
 * Everything on: the default configuration.
 */
export const Complete: Story = {};

/**
 * A crop-only picker, the shape a media library needs.
 */
export const CropOnly: Story = {
	args: {
		adjustments: [],
		annotate: [],
		filters: [],
		frames: [],
	},
};

/**
 * Straighten and fixed ratios, without free cropping extras.
 */
export const StraightenAndRatios: Story = {
	args: {
		adjustments: [],
		annotate: [],
		filters: [],
		frames: [],
		ratios: ['original', '1:1', '16:9'],
		rotate: false,
	},
};

/**
 * A colour-grading panel: adjustments and a short list of looks.
 */
export const ColourOnly: Story = {
	args: {
		annotate: [],
		crop: false,
		filters: ['none', 'grayscale', 'sepia', 'vintage', 'vivid'],
		frames: [],
	},
};

/**
 * Redaction workflow: hide faces or data, nothing else.
 */
export const RedactionOnly: Story = {
	args: {
		adjustments: [],
		annotate: ['redaction'],
		crop: false,
		filters: [],
		frames: [],
	},
};

/**
 * Review markup: the shapes people reach for when pointing at something
 * in a screenshot, and nothing else. The menu narrows with the tool list,
 * so naming two shapes offers two.
 */
export const ArrowsAndShapes: Story = {
	args: {
		adjustments: [],
		annotate: ['arrow', 'rectangle'],
		crop: false,
		filters: [],
		frames: [],
	},
};

/**
 * The expressive kit: words and the whole emoji set, nothing geometric.
 */
export const TextAndEmoji: Story = {
	args: {
		adjustments: [],
		annotate: ['text', 'emoji'],
		crop: false,
		filters: [],
		frames: [],
	},
};

/**
 * The two adjustments most tools ship with, and nothing else.
 */
export const BrightnessAndContrast: Story = {
	args: {
		adjustments: ['brightness', 'contrast'],
		annotate: [],
		crop: false,
		filters: [],
		frames: [],
	},
};

/**
 * Framing on its own: pick a frame, set its colour and its two
 * measurements, and nothing else is on the way.
 */
export const FramesOnly: Story = {
	args: {
		adjustments: [],
		annotate: [],
		crop: false,
		filters: [],
	},
};

/**
 * A print-style set: the frames a photograph is usually given, with the
 * crop that decides what they sit around.
 */
export const PrintFrames: Story = {
	args: {
		adjustments: [],
		annotate: [],
		filters: [],
		frames: ['none', 'mat', 'bevel', 'polaroid'],
		ratios: ['original', '1:1', '4:3', '3:4'],
		straighten: false,
	},
};

/**
 * Watermarking: bring in a logo, place it, and save. One tool, and the
 * layer panel that comes with it.
 */
export const WatermarkOnly: Story = {
	args: {
		adjustments: [],
		annotate: ['image'],
		crop: false,
		filters: [],
		frames: [],
	},
};

/**
 * A post composer: square and vertical crops, a short list of looks, a
 * frame, and the annotations people actually use on a social image.
 */
export const SocialPost: Story = {
	args: {
		adjustments: ['brightness', 'contrast'],
		annotate: ['text', 'arrow', 'image', 'emoji'],
		filters: ['none', 'vintage', 'vivid', 'noir'],
		frames: ['none', 'mat', 'polaroid'],
		ratios: ['1:1', '4:3', '9:16'],
		rotate: false,
		straighten: false,
	},
};
