import {renderToStaticMarkup} from 'react-dom/server';

import {DEFAULT_ADJUSTMENTS, FilterPreset} from '../state/types';
import {FilterDefs, isIdentityFilter} from './FilterDefs';

function markup(
	adjustments: Partial<typeof DEFAULT_ADJUSTMENTS>,
	filter: FilterPreset = 'none'
): string {
	return renderToStaticMarkup(
		<svg>
			<defs>
				<FilterDefs
					adjustments={{...DEFAULT_ADJUSTMENTS, ...adjustments}}
					filter={filter}
					id="test-filter"
				/>
			</defs>
		</svg>
	);
}

describe('FilterDefs', () => {
	it('detects the identity pipeline', () => {
		expect(isIdentityFilter({...DEFAULT_ADJUSTMENTS}, 'none')).toBe(true);
		expect(
			isIdentityFilter({...DEFAULT_ADJUSTMENTS, brightness: 5}, 'none')
		).toBe(false);
		expect(isIdentityFilter({...DEFAULT_ADJUSTMENTS}, 'sepia')).toBe(
			false
		);
	});

	it('maps brightness to a linear transfer slope', () => {
		expect(markup({brightness: 20})).toContain('slope="1.2"');
	});

	it('renders a tone curve table only when shadows or highlights are set', () => {
		expect(markup({})).not.toContain('tableValues');
		expect(markup({shadows: 50})).toContain('tableValues');
	});

	it('lifts the blacks with positive shadows and clamps at zero', () => {
		expect(markup({shadows: 100})).toContain('tableValues="0.3500');
		expect(markup({shadows: -100})).toContain('tableValues="0.0000');
	});

	it('drops saturation to zero for the grayscale preset', () => {
		expect(markup({saturation: 40}, 'grayscale')).toContain(
			'values="0"'
		);
	});
});
