import ClayButton from '@clayui/button';
import {ClayIconSpriteContext} from '@clayui/icon';
import {ClayTooltipProvider} from '@clayui/tooltip';
import spritemap from '@clayui/css/lib/images/icons/icons.svg';
import {useEffect, useRef, useState} from 'react';

import {t} from './i18n';
import {LoadedImage, loadImage} from './imaging/loadImage';
import {AnnouncerProvider} from './components/Announcer';
import EditorModal from './components/EditorModal';
import {watchOrphanTooltips} from './components/tooltips';

export default function App() {
	const [image, setImage] = useState<LoadedImage | null>(null);
	const [loadError, setLoadError] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => watchOrphanTooltips(), []);

	const open = async (blob: Blob, fileName: string) => {
		try {
			setLoadError(false);
			setImage(await loadImage(blob, fileName));
		}
		catch {
			setLoadError(true);
		}
	};

	const openSample = async () => {
		const response = await fetch('/sample.jpg');

		await open(await response.blob(), 'sample.jpg');
	};

	const close = () => {
		if (image) {
			URL.revokeObjectURL(image.previewUrl);
		}

		setImage(null);
	};

	return (
		<ClayIconSpriteContext.Provider value={spritemap}>
			{/*
			 * A singleton provider: delegation from document.body reaches
			 * titled elements anywhere, including portaled Clay modals.
			 */}
			<ClayTooltipProvider autoAlign delay={200} scope="[title]" />

			<AnnouncerProvider>
				<main className="landing">
					<h1>{t('app-title')}</h1>

					<p className="text-secondary">{t('app-description')}</p>

					<div className="landing-actions">
						<ClayButton
							displayType="primary"
							onClick={openSample}
						>
							{t('open-sample-image')}
						</ClayButton>

						<ClayButton
							displayType="secondary"
							onClick={() => fileInputRef.current?.click()}
						>
							{t('open-an-image')}
						</ClayButton>

						<input
							accept="image/jpeg,image/png,image/webp"
							hidden
							onChange={(event) => {
								const file = event.target.files?.[0];

								if (file) {
									open(file, file.name);
								}

								event.target.value = '';
							}}
							ref={fileInputRef}
							type="file"
						/>
					</div>

					{loadError && (
						<p className="text-danger" role="alert">
							{t('load-failed')}
						</p>
					)}
				</main>

				{image && <EditorModal image={image} onClose={close} />}
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
