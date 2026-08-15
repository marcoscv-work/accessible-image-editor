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

	var toggle = document.getElementById('theme-toggle');
	var sun = document.getElementById('theme-icon-sun');
	var moon = document.getElementById('theme-icon-moon');

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

	function show(icon, visible) {
		if (visible) {
			icon.removeAttribute('hidden');
		}
		else {
			icon.setAttribute('hidden', '');
		}
	}

	function paint(scheme) {
		var dark = scheme === 'dark';

		document.documentElement.dataset.colorScheme = scheme;

		if (!toggle) {
			return;
		}

		// The icon is the destination, not the current state: the sun
		// takes you back to light, the same way the editor's switch reads.

		var label = dark
			? 'Switch to the light colour scheme'
			: 'Switch to the dark colour scheme';

		toggle.setAttribute('aria-label', label);
		toggle.setAttribute('title', label);

		// `hidden` is an HTMLElement property: assigning it on an SVG
		// element sets a JavaScript field and nothing else, so the
		// attribute has to be written by hand.

		show(sun, dark);
		show(moon, !dark);
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
