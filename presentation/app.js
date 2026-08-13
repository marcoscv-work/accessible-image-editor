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
	 * five seconds needs a way to stop it (WCAG 2.2.2), so the control is
	 * real, and reduced motion means it never starts: the button becomes a
	 * plain switch between the two images instead.
	 */

	var compare = document.getElementById('compare');
	var toggle = document.getElementById('compare-toggle');
	var state = document.getElementById('compare-state');

	if (compare && toggle && state) {
		var playing = !reduceMotion.matches;

		var render = function () {
			compare.classList.toggle('is-playing', playing);

			if (playing) {
				compare.classList.remove('is-after');

				toggle.textContent = 'Pause';
				state.textContent = 'Cross-fading between original and Vintage';
			}
			else {
				toggle.textContent = compare.classList.contains('is-after')
					? 'Show the original'
					: 'Show Vintage';
				state.textContent = compare.classList.contains('is-after')
					? 'Showing Vintage'
					: 'Showing the original';
			}
		};

		toggle.addEventListener('click', function () {
			if (playing) {
				playing = false;
			}
			else if (reduceMotion.matches) {
				compare.classList.toggle('is-after');
			}
			else {
				playing = true;
			}

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
})();
