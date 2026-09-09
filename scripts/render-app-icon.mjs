import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BG = "#8B3A24";
const FG = "#F4E6D4";
const S = 1024;
const TARGET = 0.64;

function glyph() {
  const cell = 200;
  const gap = 52;
  const r = 52;
  const start = -(cell + gap / 2);
  const cells = [
    [start, start, 1],
    [start + cell + gap, start, 1],
    [start, start + cell + gap, 1],
    [start + cell + gap, start + cell + gap, 0.38],
  ];
  return cells
    .map(
      ([x, y, a]) =>
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${r}" opacity="${a}"/>`,
    )
    .join("");
}

function svgAt(tx, ty, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="${BG}"/>
    <g fill="${FG}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${glyph()}</g>
  </svg>`;
}

function pageHtml(width, height, svg) {
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${BG}; }
    svg { display: block; width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>${svg}</body>
</html>`;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

async function markBox(page, width, height) {
  const [br, bgG, bb] = hexToRgb(BG);
  return page.evaluate(
    ({ width, height, br, bgG, bb }) => {
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
              if (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bb) > 28) {
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
            resolve({ minX: 0, minY: 0, maxX: width, maxY: height, cx: width / 2, cy: height / 2, w: width, h: height });
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
    { width, height, br, bgG, bb },
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
const box = await markBox(page, S, S);
const scale = (S * TARGET) / Math.max(box.w, box.h);
const tx2 = S / 2 - (box.cx - S / 2) * scale;
const ty2 = S / 2 - (box.cy - S / 2) * scale;
const placed = svgAt(tx2, ty2, scale);
writeFileSync("/workspace/public/favicon.svg", placed);

await page.setContent(pageHtml(S, S, placed));
const check = await markBox(page, S, S);
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
  const size = 420;
  const x = Math.round((1200 - size) / 2);
  const y = Math.round((630 - size) / 2);
  await og.setContent(`<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; width: 1200px; height: 630px; background: ${BG}; }
    svg { display: block; position: absolute; left: ${x}px; top: ${y}px; width: ${size}px; height: ${size}px; }
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
