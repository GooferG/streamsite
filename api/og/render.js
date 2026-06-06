// api/og/render.js
import { ImageResponse } from '@vercel/og';
import { readFileSync } from 'fs';
import { join } from 'path';
import CardMinimal from './CardMinimal.js';

// Load fonts once per cold start. Files ship with the function via vercel.json
// includeFiles. If a read fails, we render without that font (Satori default)
// rather than erroring the image. NOTE: Satori (this @vercel/og version) cannot
// parse VARIABLE fonts — these are STATIC weight instances.
let FONTS = null;
function loadFonts() {
  if (FONTS) return FONTS;
  const dir = join(process.cwd(), 'api', 'og', 'fonts');
  const tryRead = (file) => {
    try { return readFileSync(join(dir, file)); } catch { return null; }
  };
  const grotesk = tryRead('SpaceGrotesk-700.ttf');
  const mono500 = tryRead('JetBrainsMono-500.ttf');
  const mono600 = tryRead('JetBrainsMono-600.ttf');
  const fonts = [];
  if (grotesk) fonts.push({ name: 'Space Grotesk', data: grotesk, weight: 700, style: 'normal' });
  if (mono500) fonts.push({ name: 'JetBrains Mono', data: mono500, weight: 500, style: 'normal' });
  if (mono600) fonts.push({ name: 'JetBrains Mono', data: mono600, weight: 600, style: 'normal' });
  FONTS = fonts;
  return fonts;
}

const HEADERS = {
  'content-type': 'image/png',
  'cache-control': 'public, max-age=30, stale-while-revalidate=300',
};

export function renderCard(props) {
  const fonts = loadFonts();
  return new ImageResponse(CardMinimal(props), {
    width: 1200,
    height: 630,
    fonts,
    headers: HEADERS,
  });
}
