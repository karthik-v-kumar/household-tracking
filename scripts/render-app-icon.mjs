import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const SHELF = `<rect x="6.4" y="6.4" width="3.6" height="19.2" rx="1.8" fill="currentColor"/>
    <rect x="6.4" y="6.4" width="19.2" height="3.6" rx="1.8" fill="currentColor"/>
    <rect x="6.4" y="14.2" width="19.2" height="3.6" rx="1.8" fill="currentColor"/>
    <rect x="6.4" y="22" width="19.2" height="3.6" rx="1.8" fill="currentColor"/>`;

function htmlFor(bg, fg, size) {
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${bg}; }
    svg { display: block; width: ${size}px; height: ${size}px; color: ${fg}; }
  </style>
</head>
<body>
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${SHELF}</svg>
</body>
</html>`;
}

mkdirSync("/tmp/icons", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
await page.setContent(htmlFor("#F3EEE4", "#1C1915", 512));
await page.screenshot({ path: "/tmp/icons/shelf-512.png", type: "png" });
await page.close();
await browser.close();
console.log("ok");
