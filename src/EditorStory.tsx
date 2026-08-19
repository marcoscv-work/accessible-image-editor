/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton from '@clayui/button';
import spritemap from '@clayui/css/lib/images/icons/icons.svg';
import {ClayIconSpriteContext} from '@clayui/icon';
import {ClayTooltipProvider} from '@clayui/tooltip';
import {useEffect, useState} from 'react';

import sampleUrl from './assets/sample.jpg';
import {AnnouncerProvider} from './components/Announcer';
import EditorModal from './components/EditorModal';
import {watchOrphanTooltips} from './components/tooltips';
import {EditorConfig} from './editorConfig';
import {t} from './i18n';
import {downloadBlob} from './imaging/exportImage';
import {LoadedImage, loadImage} from './imaging/loadImage';

/**
 * Story harness: loads the bundled sample and mounts the editor with a
 * given configuration, so every combination can be tried live. Keeping it
 * out of the stories file lets the same harness serve every story.
 */
export function EditorStory({config}: {config?: EditorConfig}) {
	const [image, setImage] = useState<LoadedImage | null>(null);

	useEffect(() => watchOrphanTooltips(), []);

	useEffect(() => {
		let cancelled = false;

		fetch(sampleUrl)
			.then((response) => response.blob())
			.then((blob) => loadImage(blob, 'sample.jpg'))
			.then((loaded) => {
				if (cancelled) {
					URL.revokeObjectURL(loaded.previewUrl);
				}
				else {
					setImage(loaded);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<ClayIconSpriteContext.Provider value={spritemap}>
			<ClayTooltipProvider autoAlign delay={200} scope="[title]" />

			<AnnouncerProvider>
				{image ? (
					<EditorModal
						config={config}
						image={image}
						key={JSON.stringify(config)}
						onClose={() => {}}
						onSave={({blob, fileName}) =>
							downloadBlob(blob, fileName)
						}
					/>
				) : (
					<div className="p-4">
						<ClayButton disabled displayType="secondary">
							{t('app-title')}
						</ClayButton>
					</div>
				)}
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
