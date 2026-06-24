import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const iconSvg = readFileSync(join(iconsDir, 'icon.svg'));
const maskableSvg = readFileSync(join(iconsDir, 'icon-maskable.svg'));

await sharp(iconSvg).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
await sharp(iconSvg).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));
await sharp(maskableSvg).resize(512, 512).png().toFile(join(iconsDir, 'icon-maskable-512.png'));

console.log('Generated PWA icons in public/icons/');
