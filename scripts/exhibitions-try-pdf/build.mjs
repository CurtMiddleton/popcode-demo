// Builds public/assets/at-work-audio-tour.pdf from try-it.html.
//
//   npm i --no-save playwright-core
//   CHROME=/path/to/chrome node scripts/exhibitions-try-pdf/build.mjs [popcode.app/slug]
//
// CHROME can be any Chromium/Chrome binary (in Claude's cloud container:
// /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell).
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const addr = process.argv[2] || 'popcode.app/wrenalder';
const out = path.join(here, '../../public/assets/at-work-audio-tour.pdf');

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage();
const url = pathToFileURL(path.join(here, 'try-it.html')).href + '?addr=' + encodeURIComponent(addr);
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('wrote', out, 'for', addr);
