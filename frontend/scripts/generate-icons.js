const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon for Rowly (knitting theme)
const createSvgIcon = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6d28d9;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)"/>

  <!-- Knitting needle (left) -->
  <line x1="${size*0.25}" y1="${size*0.75}" x2="${size*0.35}" y2="${size*0.25}"
        stroke="white" stroke-width="${size*0.04}" stroke-linecap="round"/>

  <!-- Knitting needle (right) -->
  <line x1="${size*0.75}" y1="${size*0.75}" x2="${size*0.65}" y2="${size*0.25}"
        stroke="white" stroke-width="${size*0.04}" stroke-linecap="round"/>

  <!-- Yarn strand -->
  <path d="M ${size*0.35} ${size*0.35} Q ${size*0.5} ${size*0.45}, ${size*0.65} ${size*0.35}"
        stroke="white" stroke-width="${size*0.035}" fill="none" stroke-linecap="round"/>

  <!-- Stitch markers (dots) -->
  <circle cx="${size*0.4}" cy="${size*0.5}" r="${size*0.03}" fill="white"/>
  <circle cx="${size*0.5}" cy="${size*0.53}" r="${size*0.03}" fill="white"/>
  <circle cx="${size*0.6}" cy="${size*0.5}" r="${size*0.03}" fill="white"/>
</svg>
`;

const outputDir = path.join(__dirname, '..', 'public');

async function generateIcon(size, filename) {
  const svgBuffer = Buffer.from(createSvgIcon(size));

  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(path.join(outputDir, filename));

  console.log(`✓ Generated ${filename} (${size}x${size})`);
}

async function main() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Generating PWA icons...\n');

    // Generate icons
    await generateIcon(192, 'icon-192x192.png');
    await generateIcon(512, 'icon-512x512.png');
    await generateIcon(180, 'apple-touch-icon.png');
    await generateIcon(32, 'favicon-32x32.png');
    await generateIcon(16, 'favicon-16x16.png');

    // Generate favicon.ico (using 32x32)
    const svgBuffer = Buffer.from(createSvgIcon(32));
    await sharp(svgBuffer)
      .resize(32, 32)
      .toFormat('png')
      .toFile(path.join(outputDir, 'favicon.ico'));

    console.log('✓ Generated favicon.ico (32x32)');

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
