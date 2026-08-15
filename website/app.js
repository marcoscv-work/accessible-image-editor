/**
 * SPDX-FileCopyrightText: (c) 2026 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

/*
 * Progressive enhancement only: with this file blocked the page is still a
 * complete, readable document. Nothing here is required to reach content.
 */

(function () {
	'use strict';

	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/*
	 * Scroll reveal. Elements start hidden in CSS, so anything the observer
	 * cannot reach is revealed up front rather than left invisible.
	 */

	var revealables = document.querySelectorAll('.reveal');

	function revealAll() {
		revealables.forEach(function (element) {
			element.classList.add('is-in');
		});
	}

	if (reduceMotion.matches || !('IntersectionObserver' in window)) {
		revealAll();
	}
	else {
		var revealObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-in');

						revealObserver.unobserve(entry.target);
					}
				});
			},
			{rootMargin: '0px 0px -10% 0px', threshold: 0.1}
		);

		revealables.forEach(function (element) {
			revealObserver.observe(element);
		});
	}

	/*
	 * Which section the reader is in, marked on the nav link. aria-current
	 * carries it to assistive technology, not just the underline.
	 */

	var navLinks = [].slice.call(document.querySelectorAll('.site-nav a'));

	if ('IntersectionObserver' in window && navLinks.length) {
		var sectionObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) {
						return;
					}

					navLinks.forEach(function (link) {
						var active =
							link.getAttribute('href') === '#' + entry.target.id;

						if (active) {
							link.setAttribute('aria-current', 'true');
						}
						else {
							link.removeAttribute('aria-current');
						}
					});
				});
			},
			{rootMargin: '-20% 0px -70% 0px'}
		);

		navLinks.forEach(function (link) {
			var section = document.querySelector(link.getAttribute('href'));

			if (section) {
				sectionObserver.observe(section);
			}
		});
	}

	/*
	 * The before and after pair. An animation that repeats for longer than
	 * five seconds needs a way to stop it (WCAG 2.2, 2.2.2), so the control
	 * is real: a play/pause button, plus a switch that flips between the two
	 * images while it is stopped. Reduced motion means it never starts, and
	 * the play button steps aside so only the switch remains.
	 */

	var compare = document.getElementById('compare');
	var toggle = document.getElementById('compare-toggle');
	var switcher = document.getElementById('compare-switch');
	var state = document.getElementById('compare-state');

	if (compare && toggle && switcher && state) {
		var playing = !reduceMotion.matches;

		var render = function () {
			var showingAfter = compare.classList.contains('is-after');

			compare.classList.toggle('is-playing', playing);

			toggle.hidden = reduceMotion.matches;
			toggle.setAttribute(
				'aria-label',
				playing ? 'Pause the comparison' : 'Play the comparison'
			);

			switcher.hidden = playing;
			switcher.textContent = showingAfter
				? 'Show the original'
				: 'Show Vintage';

			state.innerHTML = playing
				? 'Original <span aria-hidden="true">⇄</span> Vintage'
				: showingAfter
					? 'Vintage'
					: 'Original';
		};

		toggle.addEventListener('click', function () {
			playing = !playing;

			if (playing) {
				compare.classList.remove('is-after');
			}

			render();
		});

		switcher.addEventListener('click', function () {
			playing = false;

			compare.classList.toggle('is-after');

			render();
		});

		reduceMotion.addEventListener('change', function () {
			playing = !reduceMotion.matches;

			compare.classList.remove('is-after');

			render();
		});

		render();
	}

	/*
	 * Count the statistics up once they are on screen. The markup already
	 * holds the final value, so this only ever animates towards what is
	 * written there.
	 */

	var stats = [].slice.call(document.querySelectorAll('[data-count]'));

	if (stats.length && !reduceMotion.matches && 'IntersectionObserver' in window) {
		var countObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) {
						return;
					}

					var element = entry.target;
					var target = Number(element.getAttribute('data-count'));
					var suffix = element.getAttribute('data-suffix') || '';
					var started = null;

					var step = function (now) {
						if (started === null) {
							started = now;
						}

						var progress = Math.min((now - started) / 900, 1);
						var eased = 1 - Math.pow(1 - progress, 3);

						element.textContent =
							Math.round(target * eased) + suffix;

						if (progress < 1) {
							window.requestAnimationFrame(step);
						}
					};

					window.requestAnimationFrame(step);

					countObserver.unobserve(element);
				});
			},
			{threshold: 0.6}
		);

		stats.forEach(function (element) {
			countObserver.observe(element);
		});
	}

	/*
	 * The colour scheme. The page owns the switch, the editor
	 * demonstration owns an identical one, and both write the same key on
	 * the same origin, so a choice made in either place is the choice the
	 * other one opens with. A `storage` event carries it live between two
	 * open tabs.
	 */

	var SCHEME_KEY = 'accessible-image-editor-color-scheme';

	var SUN =
		'M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1Zm0 10.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0-1.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 12Zm7-4a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 15 8ZM3.25 8.75a.75.75 0 0 1 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5Zm9.65-5.65a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM5.22 10.78a.75.75 0 0 1 0 1.06L4.16 12.9a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm7.68 2.12a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06a.75.75 0 0 1 0 1.06ZM4.16 3.1a.75.75 0 0 1 1.06 1.06L4.16 5.22A.75.75 0 0 1 3.1 4.16L4.16 3.1Z';

	var MOON =
		'M6.2 2.1a.75.75 0 0 1 .1.83 4.9 4.9 0 0 0 6.77 6.77.75.75 0 0 1 1 1A6.4 6.4 0 1 1 5.37 1.1a.75.75 0 0 1 .83.1Z';

	var toggle = document.getElementById('theme-toggle');
	var icon = document.getElementById('theme-toggle-icon');

	function readScheme() {
		try {
			return window.localStorage.getItem(SCHEME_KEY) === 'dark'
				? 'dark'
				: 'light';
		}
		catch (error) {
			return 'light';
		}
	}

	function paint(scheme) {
		var dark = scheme === 'dark';

		document.documentElement.dataset.colorScheme = scheme;

		if (!toggle) {
			return;
		}

		var label = dark
			? 'Switch to the light colour scheme'
			: 'Switch to the dark colour scheme';

		toggle.setAttribute('aria-label', label);
		toggle.setAttribute('title', label);

		icon.setAttribute('d', dark ? MOON : SUN);
	}

	paint(readScheme());

	if (toggle) {
		toggle.addEventListener('click', function () {
			var next = readScheme() === 'dark' ? 'light' : 'dark';

			try {
				window.localStorage.setItem(SCHEME_KEY, next);
			}
			catch (error) {}

			paint(next);
		});
	}

	window.addEventListener('storage', function (event) {
		if (event.key === SCHEME_KEY) {
			paint(readScheme());
		}
	});
})();
