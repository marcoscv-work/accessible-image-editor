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
import {STICKER_KINDS} from './imaging/overlayShapes';
import {FilterPreset, RatioPreset, StickerKind} from './state/types';

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
	ratios: RatioPreset[];
	rotate: boolean;
	stickers: StickerKind[];
	straighten: boolean;
}

const meta: Meta<StoryArgs> = {
	argTypes: {
		adjustments: {control: 'check', options: ADJUSTMENT_KEYS},
		annotate: {control: 'check', options: ANNOTATE_TOOLS},
		crop: {control: 'boolean'},
		filters: {control: 'check', options: FILTER_PRESETS},
		ratios: {control: 'check', options: RATIO_PRESETS},
		rotate: {control: 'boolean'},
		stickers: {control: 'check', options: STICKER_KINDS},
		straighten: {control: 'boolean'},
	},
	args: {
		adjustments: ADJUSTMENT_KEYS,
		annotate: ANNOTATE_TOOLS,
		crop: true,
		filters: FILTER_PRESETS,
		ratios: RATIO_PRESETS,
		rotate: true,
		stickers: STICKER_KINDS,
		straighten: true,
	},
	render: ({
		adjustments,
		annotate,
		crop,
		filters,
		ratios,
		rotate,
		stickers,
		straighten,
	}) => (
		<EditorStory
			config={{
				adjustments: adjustments.length ? {sliders: adjustments} : false,
				annotate: annotate.length ? {stickers, tools: annotate} : false,
				crop: crop ? {ratios, rotate, straighten} : false,
				filters: filters.length ? {presets: filters} : false,
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
	},
};

/**
 * Annotation kit with a reduced sticker set.
 */
export const AnnotateWithFewStickers: Story = {
	args: {
		adjustments: [],
		annotate: ['text', 'stickers'],
		crop: false,
		filters: [],
		stickers: ['star', 'heart', 'check'],
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
	},
};
