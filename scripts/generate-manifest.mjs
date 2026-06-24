import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE_PATH || '/';
const normalizedBase = base.endsWith('/') ? base : `${base}/`;

const manifest = {
  name: 'Fargo Matchups',
  short_name: 'Fargo',
  description: 'Calculate race lengths and odds for all player matchups in a FargoRate match.',
  id: normalizedBase,
  start_url: normalizedBase,
  scope: normalizedBase,
  display: 'standalone',
  orientation: 'any',
  background_color: '#667eea',
  theme_color: '#667eea',
  lang: 'en-US',
  categories: ['sports', 'utilities'],
  icons: [
    {
      src: 'icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

writeFileSync(
  join(__dirname, '../public/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`Generated manifest.json with start_url=${normalizedBase}`);
