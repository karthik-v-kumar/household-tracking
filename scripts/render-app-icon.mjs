import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const CREAM = "#F3EEE4";
const INK = "#1C1915";
const S = 1024;
// Fill the iOS live area (center ~80%). Squircle clips the outer 10%.
const TARGET = 0.76;

function glyph() {
  const cx = 0;
  const cy = 0;
  const stroke = 132;
  const r = 318;

  const startDeg = 310;
  const endDeg = 244;
  const toRad = (d) => (d * Math.PI) / 180;
  const pt = (deg, rad = r) => {
    const a = toRad(deg);
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const [sx, sy] = pt(startDeg);
  const [ex, ey] = pt(endDeg);

  const headAngle = toRad(-60);
  const hx = Math.cos(headAngle);
  const hy = Math.sin(headAngle);
  const nx = -hy;
  const ny = hx;
  const tip = stroke * 1.42;
  const half = stroke * 0.86;
  const overlap = stroke * 0.62;
  const f = (n) => n.toFixed(2);

  const checkStroke = stroke * 0.97;

  return `
    <path d="M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 1 1 ${f(ex)} ${f(ey)}"
      fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"/>
    <path d="M ${f(ex + hx * tip)} ${f(ey + hy * tip)}
             L ${f(ex - hx * overlap + nx * half)} ${f(ey - hy * overlap + ny * half)}
             L ${f(ex - hx * overlap - nx * half)} ${f(ey - hy * overlap - ny * half)} Z"
      fill="currentColor"/>
    <path d="M ${f(cx - r * 0.42)} ${f(cy + r * 0.08)}
             L ${f(cx - r * 0.08)} ${f(cy + r * 0.46)}
             L ${f(cx + r * 0.58)} ${f(cy - r * 0.48)}"
      fill="none" stroke="currentColor" stroke-width="${checkStroke}"
      stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function svgAt(tx, ty, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="${CREAM}"/>
    <g color="${INK}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${glyph()}</g>
  </svg>`;
}

function pageHtml(width, height, svg) {
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${CREAM}; }
    svg { display: block; width: ${width}px; height: ${height}px; color: ${INK}; }
  </style>
</head>
<body>${svg}</body>
</html>`;
}

async function inkBox(page, width, height) {
  return page.evaluate(
    ({ width, height }) => {
      const svg = document.querySelector("svg");
      const xml = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const data = ctx.getImageData(0, 0, width, height).data;
          let minX = width;
          let minY = height;
          let maxX = 0;
          let maxY = 0;
          let found = false;
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const i = (y * width + x) * 4;
              if (data[i] < 220 || data[i + 1] < 210 || data[i + 2] < 190) {
                found = true;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
          URL.revokeObjectURL(url);
          if (!found) {
            resolve({ minX: 0, minY: 0, maxX: width, maxY: height });
            return;
          }
          resolve({
            minX,
            minY,
            maxX,
            maxY,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            w: maxX - minX,
            h: maxY - minY,
          });
        };
        img.onerror = reject;
        img.src = url;
      });
    },
    { width, height },
  );
}

mkdirSync("/workspace/public", { recursive: true });
mkdirSync("/workspace/public/__grok", { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: S, height: S },
  deviceScaleFactor: 1,
});

await page.setContent(pageHtml(S, S, svgAt(S / 2, S / 2, 1)));
const box = await inkBox(page, S, S);
const scale = (S * TARGET) / Math.max(box.w, box.h);
const tx = S / 2 - box.cx * scale + (S / 2) * (1 - scale);
const ty = S / 2 - box.cy * scale + (S / 2) * (1 - scale);
// First pass was drawn with scale 1 at (512,512). Re-center using measured ink.
const tx2 = S / 2 - (box.cx - S / 2) * scale;
const ty2 = S / 2 - (box.cy - S / 2) * scale;

const placed = svgAt(tx2, ty2, scale);
writeFileSync("/workspace/public/favicon.svg", placed);

await page.setContent(pageHtml(S, S, placed));
const check = await inkBox(page, S, S);
console.log("bbox", box, "scale", scale, "placed", check);

async function shot(width, height, outPath, type = "png") {
  const p = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await p.setContent(pageHtml(width, height, placed));
  await p.screenshot({ path: outPath, type, quality: type === "jpeg" ? 88 : undefined });
  await p.close();
}

await shot(180, 180, "/workspace/public/icon-180.png");
await shot(192, 192, "/workspace/public/icon-192.png");
await shot(512, 512, "/workspace/public/icon-512.png");
await shot(180, 180, "/workspace/public/apple-touch-icon.png");
await shot(180, 180, "/workspace/public/apple-touch-icon-precomposed.png");
await shot(180, 180, "/workspace/public/__grok/icon-180.png");

{
  const og = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const size = 520;
  const x = Math.round((1200 - size) / 2);
  const y = Math.round((630 - size) / 2);
  await og.setContent(`<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: 1200px; height: 630px; background: ${CREAM}; }
    svg { display: block; position: absolute; left: ${x}px; top: ${y}px; width: ${size}px; height: ${size}px; color: ${INK}; }
  </style>
</head>
<body>${placed}</body>
</html>`);
  await og.screenshot({ path: "/workspace/public/og.jpg", type: "jpeg", quality: 88 });
  await og.close();
}

await browser.close();
copyFileSync("/workspace/public/icon-180.png", "/workspace/public/__grok/icon-180.png");
console.log("icons ok");
