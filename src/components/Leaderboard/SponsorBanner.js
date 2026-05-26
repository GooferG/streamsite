const SEGMENTS = [
  { type: 'lead', text: 'JOIN CODE' },
  { type: 'code', text: 'BEAN' },
  { type: 'lead', text: 'ON' },
  { type: 'brand', text: 'RAINBET' },
  { type: 'sep', text: '·' },
  { type: 'lead', text: 'DAILY GIVEAWAYS' },
  { type: 'sep', text: '·' },
  { type: 'lead', text: '$50K+ MONTHLY PRIZES' },
  { type: 'sep', text: '·' },
  { type: 'lead', text: 'WAGER TO RANK' },
  { type: 'sep', text: '·' },
  { type: 'lead', text: 'WATCH THE STREAM' },
  { type: 'sep', text: '·' },
];

function SegmentSpan({ segment }) {
  if (segment.type === 'code' || segment.type === 'brand') {
    return (
      <span
        className="text-rainbet-blue-bright font-extrabold tracking-eyebrow-md"
        style={{
          textShadow:
            '0 0 12px rgba(96,165,250,0.65), 0 0 24px rgba(44,124,246,0.45)',
        }}
      >
        {segment.text}
      </span>
    );
  }
  if (segment.type === 'sep') {
    return <span className="text-white/25">{segment.text}</span>;
  }
  return <span className="text-white/75">{segment.text}</span>;
}

function Block() {
  return (
    <span className="inline-flex items-center gap-4 px-8">
      {SEGMENTS.map((seg, i) => (
        <SegmentSpan key={`${seg.type}-${i}`} segment={seg} />
      ))}
    </span>
  );
}

export default function SponsorBanner() {
  return (
    <div
      className="relative overflow-hidden border-y border-rainbet-blue/30 bg-zinc-broadcast/80"
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-rainbet-blue/8 motion-reduce:hidden"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-zinc-broadcast to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-zinc-broadcast to-transparent z-10"
        aria-hidden="true"
      />

      <div className="sponsor-banner-track whitespace-nowrap py-3.5 sm:py-4 text-sm sm:text-base font-bold tracking-eyebrow-sm font-mono uppercase">
        <Block />
        <Block />
      </div>
      <style>{`
        @keyframes sponsor-banner-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .sponsor-banner-track {
          display: inline-flex;
          min-width: 200%;
          animation: sponsor-banner-scroll 32s linear infinite;
        }
        .sponsor-banner-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .sponsor-banner-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
