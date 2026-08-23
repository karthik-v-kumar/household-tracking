import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const variants = [
  { name: "charcoal", bg: "#1C1915", fg: "#F3EEE4" },
  { name: "cream", bg: "#F3EEE4", fg: "#1C1915" },
];

function htmlFor(bg, fg, size) {
  return `<!doctype html>
<html>
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap" rel="stylesheet">
  <style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${bg}; }
    body { display: flex; align-items: center; justify-content: center; }
    span {
      font-family: "Instrument Serif", Georgia, serif;
      font-size: ${Math.round(size * 0.62)}px;
      line-height: 1;
      color: ${fg};
      font-weight: 400;
      transform: translateY(${Math.round(size * 0.02)}px);
    }
  </style>
</head>
<body><span>S</span></body>
</html>`;
}

mkdirSync("/tmp/icons", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

for (const v of variants) {
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  await page.setContent(htmlFor(v.bg, v.fg, 512), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `/tmp/icons/${v.name}-512.png`, type: "png" });
  await page.close();
}

await browser.close();
console.log("ok");
