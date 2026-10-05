import { useLayoutEffect, useRef } from 'react';

// The camera's cut for doors that aren't screens (Ruling R23): a cartoon iris.
// A square whose round hole is drawn by .camera-iris-hole (index.css) scales
// about the object's centre, and four black bars ride the square's edges so
// the black always reaches the window, even as the hole shrinks to nothing.
// Only transforms animate. Phases: 'in' closes the iris on the object, 'hold'
// is plain black, 'out' fades the black off the new page, 'open' opens the
// iris on the room. Decorative: aria-hidden and never takes the pointer.
const HOLE = 0.8; // the hole's radius over the square's half side (index.css)
const SHUT = 0.001; // closed: a speck the bars already cover
const OVERLAP = 2; // px the bars reach into the square's black corners, so no seam shows
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

// Where the square and the four bars (top, bottom, left, right) sit at rest,
// for a hole of radius r around (x, y).
function boxes({ x, y, r }) {
  const half = r / HOLE;
  const bar = 2 * r;
  return [
    { left: x - half, top: y - half, width: 2 * half, height: 2 * half },
    { left: 0, top: y - bar, width: '100%', height: bar },
    { left: 0, top: y, width: '100%', height: bar },
    { left: x - bar, top: 0, width: bar, height: '100%' },
    { left: x, top: 0, width: bar, height: '100%' },
  ];
}

// Each part's transform with the iris open by `s` (1 open, SHUT closed): the
// square scales, and the bars stand off it halfway between the hole's edge and
// the square's, minus the overlap.
function transforms(r, s) {
  const off = (s * (r + r / HOLE)) / 2 - OVERLAP;
  return [`scale(${s})`, `translateY(${-off}px)`, `translateY(${off}px)`, `translateX(${-off}px)`, `translateX(${off}px)`];
}

export default function CameraIris({ iris }) {
  const partRefs = useRef([]);
  const moving = !!iris && (iris.phase === 'in' || iris.phase === 'open');

  // Each part rests at the phase's end (inline style) and animates there from
  // its start; with no duration or no Web Animations it simply sits at the end.
  useLayoutEffect(() => {
    if (!moving || !iris.duration) return undefined;
    const [from, to] = iris.phase === 'in' ? [1, SHUT] : [SHUT, 1];
    const start = transforms(iris.at.r, from);
    const end = transforms(iris.at.r, to);
    const anims = partRefs.current.map((el, i) =>
      el && typeof el.animate === 'function'
        ? el.animate([{ transform: start[i] }, { transform: end[i] }], { duration: iris.duration, easing: EASE })
        : null
    );
    return () => anims.forEach((anim) => anim && anim.cancel());
  }, [iris, moving]);

  if (!iris) return null;
  const end = moving && transforms(iris.at.r, iris.phase === 'in' ? SHUT : 1);
  const fill = moving ? '' : `bg-black${iris.phase === 'out' ? ' camera-iris-out' : ''}`;
  return (
    <div
      aria-hidden="true"
      data-testid="camera-iris"
      data-phase={iris.phase}
      className={`pointer-events-none fixed inset-0 z-40 overflow-hidden ${fill}`}
    >
      {moving &&
        boxes(iris.at).map((box, i) => (
          <div
            key={i}
            ref={(el) => {
              partRefs.current[i] = el;
            }}
            className={`absolute will-change-transform ${i === 0 ? 'camera-iris-hole' : 'bg-black'}`}
            style={{ ...box, transform: end[i] }}
          />
        ))}
    </div>
  );
}
