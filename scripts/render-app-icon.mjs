import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const MARKS = {
  shelf: `<rect x="8" y="8" width="3.2" height="16" rx="1.6" fill="currentColor"/>
    <rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="currentColor"/>
    <rect x="8" y="14.4" width="16" height="3.2" rx="1.6" fill="currentColor"/>
    <rect x="8" y="20.8" width="16" height="3.2" rx="1.6" fill="currentColor"/>`,
  list: `<rect x="8" y="8.2" width="16" height="3.4" rx="1.7" fill="currentColor"/>
    <rect x="8" y="14.3" width="16" height="3.4" rx="1.7" fill="currentColor"/>
    <rect x="8" y="20.4" width="10" height="3.4" rx="1.7" fill="currentColor"/>`,
  crate: `<rect x="7.2" y="7.2" width="17.6" height="17.6" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <rect x="11.2" y="11.2" width="4.4" height="4.4" rx="1" fill="currentColor"/>
    <rect x="16.4" y="11.2" width="4.4" height="4.4" rx="1" fill="currentColor"/>
    <rect x="11.2" y="16.4" width="4.4" height="4.4" rx="1" fill="currentColor"/>`,
  cards: `<rect x="10.2" y="6.4" width="14.2" height="14.2" rx="3.2" fill="currentColor" opacity="0.38"/>
    <rect x="7.4" y="11.2" width="14.2" height="14.2" rx="3.2" fill="currentColor"/>`,
};

function htmlFor(mark, bg, fg, size) {
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${bg}; }
    svg { display: block; width: ${size}px; height: ${size}px; color: ${fg}; }
  </style>
</head>
<body>
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${mark}</svg>
</body>
</html>`;
}

mkdirSync("/tmp/icons", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

for (const [name, mark] of Object.entries(MARKS)) {
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  await page.setContent(htmlFor(mark, "#1C1915", "#F3EEE4", 512));
  await page.screenshot({ path: `/tmp/icons/${name}-512.png`, type: "png" });
  await page.close();
}

await browser.close();
console.log("ok", Object.keys(MARKS).join(" "));
