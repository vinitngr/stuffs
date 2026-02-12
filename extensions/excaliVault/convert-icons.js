const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
const sizes = [16, 48, 128];

async function convertIcons() {
  if (!fs.existsSync(iconsDir)) {
    console.error(`Directory not found: ${iconsDir}`);
    process.exit(1);
  }

  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    const pngPath = path.join(iconsDir, `icon${size}.png`);

    if (fs.existsSync(svgPath)) {
      try {
        await sharp(svgPath)
          .resize(size, size)
          .png()
          .toFile(pngPath);
        console.log(`Successfully converted icon${size}.svg to icon${size}.png`);
      } catch (error) {
        console.error(`Error converting icon${size}.svg:`, error);
      }
    } else {
      console.warn(`Warning: icon${size}.svg not found in ${iconsDir}`);
    }
  }
}

convertIcons();
