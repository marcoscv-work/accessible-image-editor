import {chromium} from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({deviceScaleFactor: 2, viewport: {height: 1000, width: 1400}});
await page.goto('http://localhost:5273');
await page.getByRole('button', {name: 'Edit sample image'}).click();
await page.locator('.modal').waitFor();
await page.waitForTimeout(900);

// Collapse the other sections to see the whole gallery.
for (const name of ['Crop and rotation', 'Adjustments']) {
	await page.getByRole('button', {exact: true, name}).click();
}
await page.waitForTimeout(600);
await page.locator('#filter-technicolor').check();
await page.waitForTimeout(400);
await page.locator('.editor-sidebar').screenshot({path: process.env.SCRATCH + '/filter-cards.png', scale: 'device'});

const probe = await page.evaluate(() => ({
	checkedName: document.querySelector('.editor-filter-input:checked')?.id,
	presets: document.querySelectorAll('.editor-filter-option').length,
	radioRole: document.querySelectorAll('[role="radio"], input[type="radio"]').length,
	tabbable: [...document.querySelectorAll('.editor-filter-input')].filter((i) => i.tabIndex >= 0).length,
}));
console.log(JSON.stringify(probe));
await browser.close();
