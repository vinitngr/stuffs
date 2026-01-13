// Simple icon generator - Creates basic placeholder icons
// For production, replace with professional icon designs

const fs = require('fs');

// SVG icon template (clipboard icon)
const createSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" fill="#3794ff" rx="4"/>
  <path d="M16 1H8C7.4 1 7 1.4 7 2v1H5c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V4c0-.6-.4-1-1-1h-2V2c0-.6-.4-1-1-1zm-1 2v1H9V3h6zm3 19H6V5h1v1c0 .6.4 1 1 1h8c.6 0 1-.4 1-1V5h1v17z" fill="white" transform="translate(0, -1)"/>
  <text x="12" y="18" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">0</text>
</svg>
`.trim();

// Create SVG files
['16', '48', '128'].forEach(size => {
  const svg = createSVG(size);
  fs.writeFileSync(`icon${size}.svg`, svg);
  console.log(`Created icon${size}.svg`);
});

console.log('\nSVG icons created!');
console.log('To convert to PNG, use an online tool or ImageMagick:');
console.log('  convert icon16.svg icon16.png');
console.log('  convert icon48.svg icon48.png');
console.log('  convert icon128.svg icon128.png');
console.log('\nOr use: https://cloudconvert.com/svg-to-png');
