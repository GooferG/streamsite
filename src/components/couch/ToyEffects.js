// What a poked toy throws around (spec: Toys): the can's foam, the candy bowl's
// candies and the controller's rumble lines. Flat cartoon bits under one ink
// outline, drawn inline; their colours are classes in index.css. Each bit
// rides a wrapper the size of the toy's box, so its path (CSS variables read
// by the couch-* keyframes) is in percent of the toy and scales with the room.
// Under reduced motion the can and the bowl show one still picture instead.

const pct = (n) => `${n}%`;
const ms = (n) => `${n}ms`;

// The can's mouth, in percent of its box: the foam comes out here.
const MOUTH = 'origin-[50%_5%]';
const AT_MOUTH = 'absolute left-1/2 top-[5%] -translate-x-1/2 -translate-y-1/2';

// Foam blobs: the peak (fx, fy) from the mouth, the blob's width and its start
// (as the 250 ms shake ends). Staggered so a column trails out of the mouth; a
// narrow fan, at most about 1.45 cans above the can.
const FOAM = [
  { fx: -6, fy: -136, w: 58, delay: 200 },
  { fx: 14, fy: -118, w: 52, delay: 250 },
  { fx: -24, fy: -100, w: 48, delay: 300 },
  { fx: 26, fy: -88, w: 50, delay: 350 },
  { fx: 0, fy: -110, w: 64, delay: 400 },
  { fx: -38, fy: -70, w: 42, delay: 450 },
  { fx: 40, fy: -64, w: 44, delay: 500 },
  { fx: 6, fy: -82, w: 56, delay: 550 },
];
// Droplets: sideways distance, peak and landing (from the mouth), width, start.
const DROPS = [
  { dx: -120, up: -50, dy: 75, w: 18, delay: 260 },
  { dx: 130, up: -62, dy: 85, w: 18, delay: 300 },
  { dx: -75, up: -70, dy: 60, w: 15, delay: 360 },
  { dx: 90, up: -40, dy: 55, w: 16, delay: 420 },
];

const BLOB = 'M3.2 9C.8 9 .2 6.2 2 5.2 1.6 2.6 4.2 1 6.2 2.4 7.6.6 11 1.6 10.6 4.4 12.2 5.4 11.6 9 9 9Z';
const DROP = 'M3 .6C4.2 2.6 5.4 4 5.4 5.4A2.4 2.4 0 0 1 .6 5.4C.6 4 1.8 2.6 3 .6Z';
// A foam head with a drip down the can's front; its base (y 15) sits on the rim.
const CAP =
  'M5 15C2 15 0 12 2.5 10 1 7 4 4.5 7.5 5.5 8.5 2.5 12.5 1.5 14.5 4 16.5 1 21.5.5 23.5 3.5 25.5 1.5 30.5 1.5 31.5 4.5 35 3.5 38.5 6 37.5 9 40 10.5 39.5 15 36 15H13C13 17.5 12 19.5 10.5 19.5S8 17.5 8 15Z';

function FoamCap({ calm }) {
  return (
    <span
      data-testid="fizz-cap"
      className={`absolute bottom-[93%] left-[-15%] w-[130%] origin-bottom ${calm ? '' : 'motion-safe:animate-couch-foam-cap'}`}
    >
      <svg viewBox="0 0 40 20" className="couch-foam block aspect-[2/1] w-full translate-y-1/4 overflow-visible">
        <path d={CAP} strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="20" cy="9" r="1.3" fill="none" strokeWidth="0.8" />
        <circle cx="29" cy="10.5" r="0.9" fill="none" strokeWidth="0.8" />
      </svg>
    </span>
  );
}

export function Fizz({ calm }) {
  return (
    <span className="pointer-events-none absolute inset-0" data-testid="toy-fizz">
      <FoamCap calm={calm} />
      {!calm &&
        FOAM.map((b, i) => (
          <span
            key={`f${i}`}
            data-testid="fizz-foam"
            className={`absolute inset-0 ${MOUTH} motion-safe:animate-couch-foam`}
            style={{ '--fx': pct(b.fx), '--fy': pct(b.fy), animationDelay: ms(b.delay) }}
          >
            <svg viewBox="0 0 12 10" className={`couch-foam aspect-[6/5] ${AT_MOUTH}`} style={{ width: pct(b.w) }}>
              <path d={BLOB} strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </span>
        ))}
      {!calm &&
        DROPS.map((d, i) => (
          <span
            key={`d${i}`}
            data-testid="fizz-drop"
            className="absolute inset-0 motion-safe:animate-couch-fling-x"
            style={{ '--dx': pct(d.dx), animationDelay: ms(d.delay) }}
          >
            <span
              className={`absolute inset-0 ${MOUTH} motion-safe:animate-couch-fling-y`}
              style={{ '--up': pct(d.up), '--dy': pct(d.dy), animationDelay: ms(d.delay) }}
            >
              <svg viewBox="0 0 6 8" className={`couch-soda aspect-[3/4] ${AT_MOUTH}`} style={{ width: pct(d.w) }}>
                <path d={DROP} strokeWidth="0.9" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        ))}
    </span>
  );
}

// Candies, in percent of the bowl's box: the start in the pile (x, y), width,
// the hop out (dx sideways, up to its peak, dy to the landing, all from the
// start), the tumble and the start delay. The bowl sits at the left end of the
// TV stand, so the left hops are short and land on the stand's front edge; the
// right ones land on the stand between the bowl and the TV.
const CANDIES = [
  { kind: 'wrapped', tint: 'orange', x: 58, y: 34, w: 40, dx: 52, up: -62, dy: 55, spin: 200, delay: 0 },
  { kind: 'wrapped', tint: 'pink', x: 42, y: 32, w: 40, dx: -14, up: -72, dy: 68, spin: -200, delay: 30 },
  { kind: 'drop', tint: 'purple', x: 66, y: 40, w: 22, dx: 74, up: -42, dy: 58, spin: 160, delay: 70 },
  { kind: 'drop', tint: 'yellow', x: 62, y: 38, w: 22, dx: -10, up: -55, dy: 66, spin: 140, delay: 100 },
  { kind: 'wrapped', tint: 'lime', x: 50, y: 30, w: 38, dx: 30, up: -80, dy: 62, spin: -250, delay: 130 },
];

// A wrapped sweet (a round body between two crimped twists) or a round drop.
function Candy({ kind, tint, x, y, w }) {
  const place = { left: pct(x), top: pct(y), width: pct(w) };
  const art = `couch-candy couch-candy--${tint} absolute -translate-x-1/2 -translate-y-1/2`;
  if (kind === 'wrapped') {
    return (
      <svg viewBox="0 0 32 16" className={`${art} aspect-[2/1]`} style={place} strokeWidth="1.3" strokeLinejoin="round">
        <path d="M10.5 8 3 2l1.6 3L2 8l2.6 3L3 14Zm11 0L29 2l-1.6 3L30 8l-2.6 3L29 14Z" />
        <ellipse cx="16" cy="8" rx="7.5" ry="5.5" />
        <ellipse className="couch-shine" cx="13" cy="5.8" rx="2.4" ry="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={`${art} aspect-square`} style={place} strokeWidth="1.3">
      <circle cx="8" cy="8" r="6.4" />
      <ellipse className="couch-shine" cx="5.8" cy="5.6" rx="2" ry="1.2" />
    </svg>
  );
}

export function Scatter({ calm }) {
  return (
    <span className="pointer-events-none absolute inset-0" data-testid="toy-scatter">
      {CANDIES.map((c) => {
        const spinAt = { transformOrigin: `${c.x}% ${c.y}%` };
        const hop = {
          '--dx': pct(c.dx),
          '--up': pct(c.up),
          '--dy': pct(c.dy),
          '--back': pct(Math.round(c.up / 3)),
          '--spin': `${c.spin}deg`,
          animationDelay: ms(c.delay),
        };
        return (
          <span
            key={c.tint}
            data-testid="toy-candy"
            data-kind={c.kind}
            className={`absolute inset-0 ${calm ? '' : 'motion-safe:animate-couch-hop-x'}`}
            style={calm ? { transform: `translateX(${c.dx}%)` } : hop}
          >
            <span
              className={`absolute inset-0 ${calm ? '' : 'motion-safe:animate-couch-hop-y'}`}
              style={calm ? { ...spinAt, transform: `translateY(${c.dy}%) rotate(${c.spin}deg)` } : { ...spinAt, animationDelay: ms(c.delay) }}
            >
              <Candy {...c} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// Cartoon rumble lines, two arcs each side, flashing while the controller wiggles.
const ARCS = {
  left: 'M8.5 6Q5 12 8.5 18M5 2.5Q-.5 12 5 21.5',
  right: 'M1.5 6Q5 12 1.5 18M5 2.5Q10.5 12 5 21.5',
};

export function Rumble() {
  return (
    <>
      {['left', 'right'].map((side) => (
        <span
          key={side}
          data-testid="toy-rumble"
          data-side={side}
          className={`pointer-events-none absolute top-[5%] h-[90%] w-[18%] ${
            side === 'left' ? 'right-[102%] origin-right' : 'left-[102%] origin-left'
          } motion-safe:animate-couch-rumble`}
        >
          <svg
            viewBox="0 0 10 24"
            preserveAspectRatio={side === 'left' ? 'xMaxYMid meet' : 'xMinYMid meet'}
            className="couch-rumble block h-full w-full overflow-visible"
          >
            <path d={ARCS[side]} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </>
  );
}
