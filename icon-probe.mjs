import {chromium} from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {height: 950, width: 1400}});
await page.goto('http://localhost:5273');
await page.getByRole('button', {name: 'Edit sample image'}).click();
await page.locator('.modal').waitFor();
await page.waitForTimeout(800);

const probe = await page.evaluate(() => {
	const header = [...document.querySelectorAll('.editor-panel .panel-header')].find((h) => h.textContent.includes('ADJUSTMENTS'));
	const title = header.querySelector('.panel-title');
	const icon = header.querySelector('.collapse-icon-open, .collapse-icon-closed');
	const style = getComputedStyle(icon);
	const hb = header.getBoundingClientRect();
	const tb = title.getBoundingClientRect();
	const ib = icon.getBoundingClientRect();
	return {
		headerPadding: getComputedStyle(header).padding,
		iconCenter: Math.round(ib.y + ib.height / 2 - hb.y),
		iconPosition: [style.position, style.top, style.right, style.transform],
		headerHeight: Math.round(hb.height),
		titleCenter: Math.round(tb.y + tb.height / 2 - hb.y),
	};
});
console.log(JSON.stringify(probe, null, 1));
await browser.close();
