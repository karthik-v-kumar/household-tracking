import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

// Chunky, optically centered list. Check stays in the bullet column
// (doesn't kiss row 2, doesn't shove line 1 aside).
const MARK = `
  <path d="M5.7 8.85 L8.55 11.7 L13.05 5.55" fill="none" stroke="currentColor"
    stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="15.5" y="6.55" width="11.6" height="3.35" rx="1.67" fill="currentColor"/>
  <circle cx="8.7" cy="16.35" r="2.45" fill="currentColor"/>
  <rect x="15.5" y="14.68" width="11.6" height="3.35" rx="1.67" fill="currentColor"/>
  <circle cx="8.7" cy="24.7" r="2.45" fill="currentColor"/>
  <rect x="15.5" y="23.02" width="8.4" height="3.35" rx="1.67" fill="currentColor"/>
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
await shot(1200, 630, 440, "/workspace/public/og.jpg", "jpeg");

await browser.close();
copyFileSync("/workspace/public/icon-180.png", "/workspace/public/__grok/icon-180.png");
console.log("icons ok");
