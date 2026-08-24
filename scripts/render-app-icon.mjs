import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

// Pantry goods on a shelf — stocked, not a 2x2 of empty boxes.
const MARK = `
  <rect x="5" y="24.2" width="22" height="2.2" rx="1.1" fill="currentColor"/>
  <rect x="6.3" y="7" width="5.5" height="16.4" rx="2.7" fill="currentColor"/>
  <rect x="13.25" y="11.2" width="5.6" height="12.2" rx="1.7" fill="currentColor"/>
  <rect x="20.3" y="8.4" width="5.2" height="15" rx="2.6" fill="currentColor"/>
`;

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#F3EEE4"/>
  <g fill="#1C1915">${MARK}</g>
</svg>
`;

function pageHtml(width, height, svgSize) {
  const x = Math.round((width - svgSize) / 2);
  const y = Math.round((height - svgSize) / 2);
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: #F3EEE4; }
    svg { display: block; position: absolute; left: ${x}px; top: ${y}px; width: ${svgSize}px; height: ${svgSize}px; color: #1C1915; }
  </style>
</head>
<body>
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${MARK}</svg>
</body>
</html>`;
}

mkdirSync("/workspace/public", { recursive: true });
mkdirSync("/workspace/public/__grok", { recursive: true });
writeFileSync("/workspace/public/favicon.svg", FAVICON);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

async function shot(width, height, svgSize, outPath, type = "png") {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.setContent(pageHtml(width, height, svgSize));
  await page.screenshot({ path: outPath, type, quality: type === "jpeg" ? 88 : undefined });
  await page.close();
}

await shot(180, 180, 180, "/workspace/public/icon-180.png");
await shot(192, 192, 192, "/workspace/public/icon-192.png");
await shot(512, 512, 512, "/workspace/public/icon-512.png");
await shot(180, 180, 180, "/workspace/public/apple-touch-icon.png");
await shot(180, 180, 180, "/workspace/public/apple-touch-icon-precomposed.png");
await shot(180, 180, 180, "/workspace/public/__grok/icon-180.png");
await shot(1200, 630, 360, "/workspace/public/og.jpg", "jpeg");

await browser.close();
copyFileSync("/workspace/public/icon-180.png", "/workspace/public/__grok/icon-180.png");
console.log("icons ok");
