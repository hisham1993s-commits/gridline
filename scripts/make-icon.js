// Builds the app icons from the user's own logo PNG.
// Makes the black background transparent, trims to the mark, and composes the
// icon / adaptive-foreground / monochrome / splash assets.
// Run: node scripts/make-icon.js <path-to-logo.png>
const path = require('path');
const { Jimp, rgbaToInt } = require('jimp');

const SRC = process.argv[2] || path.join(__dirname, 'logo-source.png');
const BG = rgbaToInt(13, 13, 13, 255);   // #0d0d0d
const CLEAR = rgbaToInt(0, 0, 0, 0);
const ASSETS = path.join(__dirname, '..', 'assets');

async function main() {
  const src = await Jimp.read(SRC);

  // 1. Black -> transparent.
  const d = src.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) d[i + 3] = 0;
  }

  // 2. Bounding box of visible pixels.
  let minX = src.width, minY = src.height, maxX = 0, maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (d[(y * src.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const mark = src.clone().crop({ x: minX, y: minY, w: cw, h: ch });

  // Place `mark` centred within a `size` canvas, scaled to fit `box`.
  function compose(size, box, bgColor) {
    const canvas = new Jimp({ width: size, height: size, color: bgColor });
    const scale = Math.min(box / mark.width, box / mark.height);
    const w = Math.round(mark.width * scale);
    const h = Math.round(mark.height * scale);
    const m = mark.clone().resize({ w, h });
    canvas.composite(m, Math.round((size - w) / 2), Math.round((size - h) / 2));
    return canvas;
  }

  const icon = compose(1024, 680, BG);
  await icon.write(path.join(ASSETS, 'icon.png'));
  await icon.clone().write(path.join(ASSETS, 'splash-icon.png'));
  await icon.clone().write(path.join(ASSETS, 'favicon.png'));

  // Adaptive foreground + monochrome: mark in the safe zone, transparent bg.
  await compose(1024, 560, CLEAR).write(path.join(ASSETS, 'android-icon-foreground.png'));
  await compose(1024, 560, CLEAR).write(path.join(ASSETS, 'android-icon-monochrome.png'));

  // Solid background tile.
  await new Jimp({ width: 1024, height: 1024, color: BG })
    .write(path.join(ASSETS, 'android-icon-background.png'));

  console.log('Icons written from', path.basename(SRC));
}

main().catch((e) => { console.error(e); process.exit(1); });
