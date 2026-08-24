import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const CREAM = "#F3EEE4";
const INK = "#1C1915";

function mark() {
  const cx = 64;
  const cy = 66.5;
  const r = 35.8;
  const startDeg = 308;
  const endDeg = 246;
  const toRad = (d) => (d * Math.PI) / 180;
  const pt = (deg, rad = r) => {
    const a = toRad(deg);
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const [sx, sy] = pt(startDeg);
  const [ex, ey] = pt(endDeg);

  const headAngle = toRad(-62);
  const hx = Math.cos(headAngle);
  const hy = Math.sin(headAngle);
  const nx = -hy;
  const ny = hx;
  const tip = 18.5;
  const half = 11.4;
  const inset = 8.4;
  const tipX = ex + hx * tip;
  const tipY = ey + hy * tip;
  const b1x = ex - hx * inset + nx * half;
  const b1y = ey - hy * inset + ny * half;
  const b2x = ex - hx * inset - nx * half;
  const b2y = ey - hy * inset - ny * half;
  const f = (n) => n.toFixed(2);

  return `
    <path d="M ${f(sx)} ${f(sy)} A ${r} ${r} 0 1 1 ${f(ex)} ${f(ey)}"
      fill="none" stroke="currentColor" stroke-width="13.8" stroke-linecap="round"/>
    <path d="M ${f(tipX)} ${f(tipY)} L ${f(b1x)} ${f(b1y)} L ${f(b2x)} ${f(b2y)} Z"
      fill="currentColor"/>
    <path d="M 46.4 70.8 L 58.6 84.2 L 90.6 48.4"
      fill="none" stroke="currentColor" stroke-width="13.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

const MARK = mark();

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${CREAM}"/>
  <g color="${INK}">${MARK}</g>
</svg>
`;

function pageHtml(width, height, svgSize) {
  const x = Math.round((width - svgSize) / 2);
  const y = Math.round((height - svgSize) / 2);
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${CREAM}; }
    svg { display: block; position: absolute; left: ${x}px; top: ${y}px; width: ${svgSize}px; height: ${svgSize}px; color: ${INK}; }
  </style>
</head>
<body>
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">${MARK}</svg>
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
