import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

// 2x2 pantry: three stocked, one out. Stroke on the empty tile is inset
// so its outer edge matches the filled tiles (a centered stroke would overshoot).
const SLOTS = `
  <rect x="5.4" y="5.4" width="9.4" height="9.4" rx="2.3" fill="currentColor"/>
  <rect x="17.2" y="5.4" width="9.4" height="9.4" rx="2.3" fill="currentColor"/>
  <rect x="5.4" y="17.2" width="9.4" height="9.4" rx="2.3" fill="currentColor"/>
  <rect x="18.35" y="18.35" width="7.1" height="7.1" rx="1.7" fill="none"
    stroke="currentColor" stroke-width="2.3"/>
`;

function htmlFor(size) {
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: #F3EEE4; }
    svg { display: block; width: ${size}px; height: ${size}px; color: #1C1915; }
  </style>
</head>
<body>
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${SLOTS}</svg>
</body>
</html>`;
}

mkdirSync("/tmp/icons", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
await page.setContent(htmlFor(512));
await page.screenshot({ path: "/tmp/icons/slots-512.png", type: "png" });
await page.close();
await browser.close();
console.log("ok");
