/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import ClayButton, {ClayButtonWithIcon} from '@clayui/button';
import spritemap from '@clayui/css/lib/images/icons/icons.svg';
import ClayIcon, {ClayIconSpriteContext} from '@clayui/icon';
import {ClayTooltipProvider} from '@clayui/tooltip';
import {useEffect, useRef, useState} from 'react';

import sampleUrl from './assets/sample.jpg';
import {AnnouncerProvider} from './components/Announcer';
import EditorModal from './components/EditorModal';
import {watchOrphanTooltips} from './components/tooltips';
import {configFromSearch} from './editorConfig';
import {t} from './i18n';
import {LoadedImage, loadImage} from './imaging/loadImage';

const SCHEME_KEY = 'accessible-image-editor-color-scheme';

/**
 * The colour scheme switch, and the only place the demonstration differs
 * from what the portal will do: DXP sets `data-color-scheme` on the
 * document from the theme, so the editor never has to know about it. Here
 * the page sets it itself so dark mode can be previewed.
 */
function ThemeToggle() {
	// Portal keeps the choice in the session and defaults to light rather
	// than to the operating system, so the demonstration remembers it too
	// and starts the same way. localStorage stands in for the session.

	const [scheme, setScheme] = useState<'dark' | 'light'>(() => {
		const stored = window.localStorage?.getItem(SCHEME_KEY);

		return stored === 'dark' ? 'dark' : 'light';
	});

	useEffect(() => {
		document.documentElement.dataset.colorScheme = scheme;

		window.localStorage?.setItem(SCHEME_KEY, scheme);
	}, [scheme]);

	// The website carries the same switch and writes the same key on the
	// same origin, so a choice made over there is already the choice this
	// page opens with; this keeps two open tabs together as well.

	useEffect(() => {
		const follow = (event: StorageEvent) => {
			if (event.key === SCHEME_KEY) {
				setScheme(event.newValue === 'dark' ? 'dark' : 'light');
			}
		};

		window.addEventListener('storage', follow);

		return () => window.removeEventListener('storage', follow);
	}, []);

	const dark = scheme === 'dark';

	return (
		<ClayButtonWithIcon
			aria-label={dark ? t('use-light-theme') : t('use-dark-theme')}
			className="demo-theme-toggle"
			displayType="secondary"
			onClick={() => setScheme(dark ? 'light' : 'dark')}
			size="sm"
			symbol={dark ? 'sun' : 'moon'}
			title={dark ? t('use-light-theme') : t('use-dark-theme')}
		/>
	);
}

export default function App() {
	const [image, setImage] = useState<LoadedImage | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [dropping, setDropping] = useState(false);

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
		// Imported as a module so the bundler fingerprints it: a new
		// sample can never be masked by a cached URL.

		const response = await fetch(sampleUrl);

		await open(await response.blob(), 'sample.jpg');
	};

	/**
	 * Dropping a file is an extra route, never the only one: the button
	 * beside it opens the same picker for anyone who cannot drag.
	 */
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();

		setDropping(false);

		const file = event.dataTransfer.files?.[0];

		if (file) {
			open(file, file.name);
		}
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
				<main
					className={`landing${dropping ? ' is-dropping' : ''}`}
					onDragLeave={(event) => {
						if (event.currentTarget === event.target) {
							setDropping(false);
						}
					}}
					onDragOver={(event) => {
						event.preventDefault();
						setDropping(true);
					}}
					onDrop={handleDrop}
				>
					<div className="landing-shell">
						<div className="landing-intro">
							<div className="landing-top">
								<p className="landing-eyebrow">
									{t('landing-tagline')}
								</p>

								<ThemeToggle />
							</div>

							<h1>{t('app-title')}</h1>

							<p className="landing-lead">
								{t('app-description')}
							</p>

							<div className="landing-open">
								<div className="landing-actions">
								<ClayButton
									displayType="primary"
									onClick={openSample}
								>
									<span className="inline-item inline-item-before">
										<ClayIcon symbol="picture" />
									</span>

									{t('open-sample-image')}
								</ClayButton>

								<ClayButton
									displayType="secondary"
									onClick={() =>
										fileInputRef.current?.click()
									}
								>
									<span className="inline-item inline-item-before">
										<ClayIcon symbol="upload" />
									</span>

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

							{/*
							  * A pointer affordance: it explains and accepts a
							  * drop, and clicking it opens the same picker as
							  * the button above, which is the route that does
							  * not depend on dragging. It is deliberately not a
							  * second tab stop for the same action.
							  */}
							<div
								className="landing-dropzone"
								onClick={() => fileInputRef.current?.click()}
							>
								<span
									aria-hidden="true"
									className="landing-dropzone-icon"
								>
									<ClayIcon symbol="download" />
								</span>

								<p className="landing-dropzone-title">
									{dropping
										? t('landing-dropping')
										: t('landing-drop')}
								</p>

								<p className="landing-dropzone-hint">
									{t('landing-drop-anywhere')}
								</p>
								</div>
							</div>

							{loadError && (
								<p className="text-danger" role="alert">
									{t('load-failed')}
								</p>
							)}

						</div>

						<figure className="landing-preview">
							<img alt={t('landing-sample-alt')} src={sampleUrl} />
						</figure>
					</div>
				</main>

				{image && (
					<EditorModal
						config={configFromSearch(window.location.search)}
						image={image}
						onClose={close}
					/>
				)}
			</AnnouncerProvider>
		</ClayIconSpriteContext.Provider>
	);
}
