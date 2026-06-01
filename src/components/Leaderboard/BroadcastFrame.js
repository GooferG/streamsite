import { useSessionTimecode } from '../../hooks/useSessionTimecode';

const CORNERS = [
  { pos: 'top-1.5 left-1.5', glyph: '◤' },
  { pos: 'top-1.5 right-1.5', glyph: '◥' },
  { pos: 'bottom-1.5 left-1.5', glyph: '◣' },
  { pos: 'bottom-1.5 right-1.5', glyph: '◢' },
];

export default function BroadcastFrame({ children }) {
  const timecode = useSessionTimecode();

  return (
    <div className="relative overflow-hidden border border-phosphor/20 bg-zinc-card/40 motion-safe:animate-bc-flicker">
      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* CRT light sweep */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-[2] h-36 motion-reduce:hidden motion-safe:animate-bc-sweep"
        aria-hidden="true"
        style={{
          top: '-160px',
          background:
            'linear-gradient(180deg, transparent, rgba(31,243,154,0.05), transparent)',
        }}
      />

      {CORNERS.map(({ pos, glyph }) => (
        <span
          key={pos}
          className={`pointer-events-none absolute ${pos} z-10 text-phosphor/70 text-xs font-bold leading-none select-none`}
          aria-hidden="true"
        >
          {glyph}
        </span>
      ))}

      <div className="pointer-events-none absolute top-2 right-6 sm:right-8 z-10 flex items-center gap-2 text-[10px] font-bold font-mono tracking-eyebrow-lg text-white/65">
        <span
          className="inline-block w-2 h-2 rounded-full bg-red-destructive animate-pulse motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span aria-hidden="true">SESSION {timecode}</span>
      </div>

      <div className="relative z-[3]">{children}</div>
    </div>
  );
}
