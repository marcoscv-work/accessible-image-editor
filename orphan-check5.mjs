import {chromium} from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {height: 900, width: 1400}});
await page.goto('http://localhost:5273');

await page.evaluate(() => {
	const probe = document.createElement('button');
	probe.id = 'probe-btn';
	probe.title = 'Probe tooltip';
	probe.textContent = 'probe';
	probe.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999';
	document.body.append(probe);
});

await page.mouse.move(400, 400, {steps: 5});
await page.mouse.down();
await page.mouse.up();
await page.locator('#probe-btn').hover();
await page.waitForTimeout(700);

const before = await page.locator('.tooltip').count();

// Unmount the anchor while its tooltip is open (what closing the modal
// or deleting a hovered layer row does).
await page.evaluate(() => document.getElementById('probe-btn').remove());
await page.waitForTimeout(400);

const after = await page.locator('.tooltip').count();
console.log(JSON.stringify({after, before}));
await browser.close();
