// File: desktop/scripts/make-icons.js
// Draws the Murmur logo (frontend/public/logo.svg: a rounded square with four
// rounded bars) into the PNG/ICO files the desktop app needs. Pure Node, no
// image libraries: shapes are rasterised with 4x4 supersampling.
//
//   node scripts/make-icons.js
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.resolve(__dirname, '..', 'assets');

// Logo geometry in the SVG's 64x64 viewBox.
const LOGO = [
  { x: 0, y: 0, w: 64, h: 64, r: 16, color: '#1a1a1a' },
  { x: 13, y: 26, w: 6, h: 12, r: 3, color: '#f0d7ff' },
  { x: 23, y: 18, w: 6, h: 28, r: 3, color: '#fcfcfb' },
  { x: 33, y: 12, w: 6, h: 40, r: 3, color: '#fcfcfb' },
  { x: 43, y: 22, w: 6, h: 20, r: 3, color: '#84cdc1' },
];
// "Listening" badge for the tray icon.
const BADGE = [
  { cx: 50, cy: 50, radius: 14, color: '#1a1a1a' },
  { cx: 50, cy: 50, radius: 10.5, color: '#ff6c4c' },
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function roundedRectDistance(px, py, { x, y, w, h, r }) {
  const qx = Math.abs(px - (x + w / 2)) - w / 2 + r;
  const qy = Math.abs(py - (y + h / 2)) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function render(size, { badge = false } = {}) {
  const shapes = [
    ...LOGO.map((s) => ({ ...s, inside: (px, py) => roundedRectDistance(px, py, s) <= 0 })),
    ...(badge ? BADGE.map((c) => ({ ...c, inside: (px, py) => Math.hypot(px - c.cx, py - c.cy) <= c.radius })) : []),
  ];
  const pixels = Buffer.alloc(size * size * 4);
  const SS = 4;
  const scale = 64 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Composite each shape's coverage over the result ("source over").
      let [r, g, b, a] = [0, 0, 0, 0];
      for (const shape of shapes) {
        let hits = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            if (shape.inside((x + (sx + 0.5) / SS) * scale, (y + (sy + 0.5) / SS) * scale)) hits++;
          }
        }
        if (!hits) continue;
        const coverage = hits / (SS * SS);
        const [sr, sg, sb] = rgb(shape.color);
        const outA = coverage + a * (1 - coverage);
        r = (sr * coverage + r * a * (1 - coverage)) / outA;
        g = (sg * coverage + g * a * (1 - coverage)) / outA;
        b = (sb * coverage + b * a * (1 - coverage)) / outA;
        a = outA;
      }
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
      pixels[i + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, pixels);
}

// --- PNG -------------------------------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- ICO (PNG-compressed entries, supported since Windows Vista) ------------
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => {
  fs.writeFileSync(path.join(OUT, name), data);
  console.log(`  assets/${name} (${data.length} bytes)`);
};

console.log('Drawing icons:');
write('icon.png', render(256));
write('icon.ico', encodeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: render(size) }))));
// Tray: Electron picks the @1.5x/@2x files on high-DPI displays.
for (const [suffix, size] of [['', 16], ['@1.5x', 24], ['@2x', 32]]) {
  write(`tray${suffix}.png`, render(size));
  write(`tray-recording${suffix}.png`, render(size, { badge: true }));
}
