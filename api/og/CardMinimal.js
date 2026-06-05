// api/og/CardMinimal.js
// Variant-agnostic 1200x630 share card as a Satori element tree. Driven entirely
// by the uniform props from cardProps.js. Hex tokens per the design handoff.
const C = {
  bg: 'linear-gradient(155deg, #112019 0%, #131218 45%, #1b1426 100%)',
  emerald: '#10b981',
  emeraldBright: '#34d399',
  ctaText: '#052e22',
  liveRed: '#f0506e',
  redFill: 'rgba(240,80,110,0.12)',
  redBorder: 'rgba(240,80,110,0.40)',
  greenFill: 'rgba(16,185,129,0.12)',
  greenBorder: 'rgba(16,185,129,0.40)',
  text: '#f4f3f6',
  dim: '#a9a6b3',
  faint: '#7a7785',
  divider: 'rgba(244,243,246,0.18)',
};

const div = (style, children) => ({ type: 'div', props: { style, children } });
const span = (style, children) => ({ type: 'span', props: { style, children } });

function Stat({ label, value }) {
  return div(
    { display: 'flex', flexDirection: 'column', gap: 8 },
    [
      span({ fontSize: 15, letterSpacing: '0.14em', color: C.faint, fontFamily: 'JetBrains Mono', textTransform: 'uppercase' }, label),
      span({ fontSize: 52, fontWeight: 700, color: C.text, fontFamily: 'Space Grotesk', fontVariantNumeric: 'tabular-nums' }, value),
    ]
  );
}

export default function CardMinimal(p) {
  const live = p.pill.tone === 'live';
  const pillFill = live ? C.redFill : C.greenFill;
  const pillBorder = live ? C.redBorder : C.greenBorder;
  const pillDot = live ? C.liveRed : C.emerald;
  const titleSize = (p.huntName || '').length > 18 ? 84 : 104;

  return div(
    {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '56px 64px', backgroundImage: C.bg, color: C.text,
      fontFamily: 'Space Grotesk',
    },
    [
      // Top row
      div(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        [
          div(
            {
              display: 'flex', alignItems: 'center', gap: 14,
              border: `1px solid ${pillBorder}`, background: pillFill,
              borderRadius: 40, padding: '12px 22px',
            },
            [
              div({ display: 'flex', width: 16, height: 16, borderRadius: 8, background: pillDot }, []),
              span({ fontSize: 22, letterSpacing: '0.16em', color: C.text, fontFamily: 'JetBrains Mono', fontWeight: 600, textTransform: 'uppercase' }, p.pill.text),
            ]
          ),
          span({ fontSize: 18, letterSpacing: '0.22em', color: C.faint, fontFamily: 'JetBrains Mono' }, 'GOOFERG · CH 02'),
        ]
      ),
      // Center
      div(
        { display: 'flex', flexDirection: 'column', margin: 'auto 0' },
        [
          span({ fontSize: 24, letterSpacing: '0.2em', color: C.emeraldBright, fontFamily: 'JetBrains Mono', marginBottom: 20, textTransform: 'uppercase' }, p.kicker),
          span({ display: 'flex', fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 0.94, color: C.text }, p.huntName),
        ]
      ),
      // Foot row
      div(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
        [
          div(
            { display: 'flex', alignItems: 'center', gap: 34 },
            [
              Stat(p.statA),
              div({ display: 'flex', width: 1, height: 56, background: C.divider }, []),
              Stat(p.statB),
            ]
          ),
          div(
            {
              display: 'flex', background: C.emerald, color: C.ctaText,
              fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 22,
              padding: '14px 24px', borderRadius: 12,
            },
            p.cta
          ),
        ]
      ),
    ]
  );
}
