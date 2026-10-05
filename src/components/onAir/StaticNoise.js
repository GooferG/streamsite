// Channel-change static: the noise and rolling band the Monitor, the couch TV
// and the camera's cut all share. Decorative, so aria-hidden. The noise is
// drawn once into a tile of grey grains; the layer it tiles jumps around by
// transform on a stepped clock, so the static never repaints and runs no
// filter while it plays.
export const TILE = 128; // pixels a side; each shows as a 2px grain
const GRAIN = 2;
const LEVELS = 16; // greys, 4 bits a pixel

// A random grey, contrasty the way the old contrast(1.6) filter made it: about
// a fifth of the grains black and a fifth white.
const grey = () => Math.min(LEVELS - 1, Math.max(0, Math.round(((Math.random() - 0.5) * 1.6 + 0.5) * (LEVELS - 1))));

let tile = null;

// The tile as a 4-bit greyscale BMP data URL, made once per page. No canvas,
// so it costs no pixel readback and draws where there is none (tests).
export function staticTile() {
  if (tile) return tile;
  const row = TILE / 2; // two pixels a byte
  const offset = 14 + 40 + LEVELS * 4;
  const bytes = new Uint8Array(offset + row * TILE);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42; // "BM"
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, offset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, TILE, true);
  view.setInt32(22, TILE, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 4, true);
  view.setUint32(34, row * TILE, true);
  view.setUint32(46, LEVELS, true);
  for (let i = 0; i < LEVELS; i += 1) {
    const g = Math.round((i * 255) / (LEVELS - 1));
    bytes.set([g, g, g, 0], 54 + i * 4);
  }
  for (let i = offset; i < bytes.length; i += 1) bytes[i] = (grey() << 4) | grey();
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  tile = `data:image/bmp;base64,${btoa(binary)}`;
  return tile;
}

export default function StaticNoise({ className = '', style, testId = 'onair-static' }) {
  return (
    <div
      className={`pointer-events-none overflow-hidden bg-[#07060a] ${className}`}
      style={style}
      data-testid={testId}
      aria-hidden="true"
    >
      {/* Bigger than the box by more than the farthest jump (onair-static), so no edge shows. */}
      <div
        data-static-noise
        className="absolute inset-[-64px] opacity-[0.85] motion-safe:animate-onair-static"
        style={{ backgroundImage: `url(${staticTile()})`, backgroundSize: `${TILE * GRAIN}px`, imageRendering: 'pixelated' }}
      />
      {/* Fixed scanlines over the moving noise (index.css). */}
      <div className="onair-scanlines absolute inset-0" />
      <div className="absolute inset-x-0 h-[30%] motion-safe:animate-onair-roll bg-gradient-to-b from-transparent via-white/[0.35] to-transparent" />
    </div>
  );
}
