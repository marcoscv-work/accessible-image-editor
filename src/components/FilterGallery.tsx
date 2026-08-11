import {t} from '../i18n';
import {FilterDefs} from '../imaging/FilterDefs';
import {LoadedImage} from '../imaging/loadImage';
import {EditorAction} from '../state/editorReducer';
import {DEFAULT_ADJUSTMENTS, FilterPreset} from '../state/types';

const PRESETS: FilterPreset[] = [
	'none',
	'grayscale',
	'noir',
	'sepia',
	'vintage',
	'warm',
	'cool',
	'vivid',
	'invert',
];

interface Props {
	dispatch: (action: EditorAction) => void;
	filter: FilterPreset;
	image: LoadedImage;
	onAnnounce: (message: string) => void;
}

/**
 * The filter presets as a native radio group (Clay custom-radio markup);
 * each option carries a live thumbnail rendered through the exact same
 * filter pipeline the preview and the export use.
 */
export function FilterGallery({dispatch, filter, image, onAnnounce}: Props) {
	return (
		<fieldset className="editor-panel">
			<legend className="editor-panel-title">{t('filters')}</legend>

			<div className="editor-filter-grid">
				{PRESETS.map((preset) => {
					const label = t(`filter-${preset}`);

					return (
						<div
							className="custom-control custom-radio editor-filter-option"
							key={preset}
						>
							<input
								checked={filter === preset}
								className="custom-control-input"
								id={`filter-${preset}`}
								name="filter-preset"
								onChange={() => {
									dispatch({
										filter: preset,
										type: 'set-filter',
									});
									onAnnounce(t('filter-set', label));
								}}
								type="radio"
								value={preset}
							/>

							<label
								className="custom-control-label"
								htmlFor={`filter-${preset}`}
							>
								<svg
									aria-hidden="true"
									className="editor-filter-thumb"
									height={40}
									viewBox="0 0 64 40"
									width={64}
								>
									<defs>
										<FilterDefs
											adjustments={DEFAULT_ADJUSTMENTS}
											filter={preset}
											id={`filter-thumb-${preset}`}
										/>
									</defs>

									<image
										filter={
											preset === 'none'
												? undefined
												: `url(#filter-thumb-${preset})`
										}
										height={40}
										href={image.previewUrl}
										preserveAspectRatio="xMidYMid slice"
										width={64}
									/>
								</svg>

								<span>{label}</span>
							</label>
						</div>
					);
				})}
			</div>
		</fieldset>
	);
}
