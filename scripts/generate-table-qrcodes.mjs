/**
 * Local generator: table QR PNGs + A4 print sheet for Aims Solution IFM.
 * Encodes the isolated restaurant site only (aimsrestaurantapp.netlify.app).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "qrcodes");
const BASE_URL = "https://aimsrestaurantapp.netlify.app/?table=";
const TABLES = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0"));

await fs.mkdir(OUT_DIR, { recursive: true });

for (const table of TABLES) {
  const url = `${BASE_URL}${table}`;
  const pngPath = path.join(OUT_DIR, `table-${table}.png`);
  await QRCode.toFile(pngPath, url, {
    type: "png",
    width: 640,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
  console.log(`wrote ${pngPath} -> ${url}`);
}

const stickers = TABLES.map(
  (table) => `
    <article class="sticker">
      <p class="brand">Aims Solution</p>
      <p class="venue">IFM Kopitiam</p>
      <p class="table-label">Table</p>
      <p class="table-num">${table}</p>
      <img class="qr" src="table-${table}.png" alt="QR code for table ${table}" />
      <p class="hint">Scan to order</p>
    </article>`
).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aims Solution IFM — Table QR stickers</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
    }
    .print-bar {
      max-width: 210mm;
      margin: 12px auto;
      padding: 0 8mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .print-bar p { margin: 0; font-size: 13px; color: #333; }
    button {
      font: inherit;
      padding: 8px 14px;
      cursor: pointer;
      border: 1px solid #222;
      background: #111;
      color: #fff;
      border-radius: 6px;
    }
    .sheet {
      width: 194mm;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(5, 50mm);
      gap: 2.5mm;
    }
    .sticker {
      border: 1px dashed #888;
      border-radius: 4mm;
      padding: 2mm 2mm 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      text-align: center;
      overflow: hidden;
    }
    .brand {
      margin: 0;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.15;
    }
    .venue {
      margin: 0.4mm 0 0;
      font-size: 8pt;
      color: #444;
      line-height: 1.15;
    }
    .table-label {
      margin: 1mm 0 0;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #555;
    }
    .table-num {
      margin: 0;
      font-size: 20pt;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.04em;
    }
    .qr {
      width: 24mm;
      height: 24mm;
      margin-top: 1mm;
      image-rendering: pixelated;
    }
    .hint {
      margin: 0.8mm 0 0;
      font-size: 7pt;
      color: #555;
    }
    @media print {
      .print-bar { display: none; }
      .sheet { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <p>20 table QR stickers · A4 · cut on dashed lines</p>
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <section class="sheet">
    ${stickers}
  </section>
</body>
</html>
`;

const htmlPath = path.join(OUT_DIR, "print-sheet.html");
await fs.writeFile(htmlPath, html, "utf8");
console.log(`wrote ${htmlPath}`);
console.log(`done: ${TABLES.length} QR codes`);
