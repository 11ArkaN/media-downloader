const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
const svgPath = path.join(__dirname, 'public', 'icon.svg');

async function createIco() {
  // Generate proper PNGs from SVG using sharp
  const sizes = [16, 32, 48, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Also regenerate the Tauri PNGs
  const tauriSizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    { name: 'icon.png', size: 512 },
  ];

  for (const t of tauriSizes) {
    await sharp(svgPath)
      .resize(t.size, t.size)
      .png()
      .toFile(path.join(iconsDir, t.name));
  }

  // Build ICO manually
  // ICO format: ICONDIR header + ICONDIRENTRY[] + image data
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * numImages;

  let totalSize = dataOffset;
  for (const p of pngBuffers) totalSize += p.buf.length;

  const ico = Buffer.alloc(totalSize);

  // ICONDIR
  ico.writeUInt16LE(0, 0);      // reserved = 0
  ico.writeUInt16LE(1, 2);      // type = 1 (ICO)
  ico.writeUInt16LE(numImages, 4);

  let offset = dataOffset;
  for (let i = 0; i < numImages; i++) {
    const { size, buf } = pngBuffers[i];
    const entryOffset = headerSize + i * entrySize;

    ico.writeUInt8(size >= 256 ? 0 : size, entryOffset);      // width
    ico.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);   // height
    ico.writeUInt8(0, entryOffset + 2);                         // color palette
    ico.writeUInt8(0, entryOffset + 3);                         // reserved
    ico.writeUInt16LE(1, entryOffset + 4);                      // color planes
    ico.writeUInt16LE(32, entryOffset + 6);                     // bits per pixel
    ico.writeUInt32LE(buf.length, entryOffset + 8);             // size of image data
    ico.writeUInt32LE(offset, entryOffset + 12);                // offset to image data

    buf.copy(ico, offset);
    offset += buf.length;
  }

  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
  console.log('icon.ico created successfully (' + totalSize + ' bytes)');
}

createIco().catch(err => {
  console.error(err);
  process.exit(1);
});
