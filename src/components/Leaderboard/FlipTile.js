import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// FlipTile renders a single split-flap card. Skin is provided by the caller via
// className/style so it can be reused across themes (Casino now, Neon later). It
// animates a downward split-flap fold whenever `value` changes. Reduced-motion
// users get an instant swap (no fold).
//
// The component owns only the flip MECHANICS + layout. All colors, borders,
// fonts, shadows and the seam color come from props.
//
// Props:
//   value      : string|number — the digit(s) to show (e.g. "07"). Required.
//   className  : string — skin classes for the card face (border, text color, font).
//   style      : object — inline style for the card face (gradients/shadows).
//   seamColor  : string — CSS color for the center fold seam line.
//   widthClass : string — width/padding utility classes for the tile.
//   textClass  : string — font/size/color utilities for the digit.
//   nudge      : string — vertical optical-centering transform for the digit.
//                Defaults to a small upward shift tuned for a serif (Cormorant);
//                sans fonts (e.g. Orbitron) sit higher and want a smaller value.
export default function FlipTile({
  value,
  className = '',
  style,
  seamColor = 'rgba(0,0,0,0.6)',
  widthClass = '',
  textClass = '',
  nudge = 'translateY(-0.07em)',
}) {
  // Normalize so string "07" and number 7 both behave; SSR/undefined safe.
  const current = value == null ? '' : String(value);

  const prevRef = useRef(current);
  const [animating, setAnimating] = useState(false);
  // The value the folding (old) leaf displays. Captured at change time.
  const [prevValue, setPrevValue] = useState(current);
  // Bumped on each change so the end-of-fold effect only fires for the latest
  // fold (and rapid ticks restart cleanly).
  const [flipId, setFlipId] = useState(0);

  // Detect the value change DURING render (not in an effect) so the folding
  // leaves mount in the SAME commit as the new value. Doing this in useEffect
  // left one painted frame where the new number showed with no leaves yet —
  // a visible flicker before the fold. This is React's "adjust state during
  // render" pattern: cheap, runs before paint, no extra frame.
  if (prevRef.current !== current) {
    const old = prevRef.current;
    prevRef.current = current;
    if (prefersReducedMotion()) {
      // Reduced motion: never fold; static layer shows the live value at once.
      if (animating) setAnimating(false);
    } else {
      setPrevValue(old);
      setAnimating(true);
      setFlipId((n) => n + 1);
    }
  }

  // End the fold ~450ms after it starts. Keyed on flipId so each fold gets its
  // own timer and a rapid retick cancels the prior one.
  useEffect(() => {
    if (!animating) return undefined;
    const t = setTimeout(() => setAnimating(false), 450);
    return () => clearTimeout(t);
  }, [flipId, animating]);

  // A half-card leaf: folds the card's FILL (background) + digit clipped to one
  // half via overflow-hidden. The frame (border) is NOT redrawn here — the
  // static outer card owns the border, so the leaf folds the "paper" inside the
  // frame rather than stacking a second border at the seam (which thickened the
  // fold line). Inset shadow is also dropped on the leaf for the same reason.
  //   half "top": shows the fill's top half — pinned to the leaf top, digit
  //               aligned to its top.
  //   half "bottom": shows the fill's bottom half — offset up by the full tile
  //               height, digit pulled up so its lower half lands in view.
  const fillStyle = style ? { background: style.background } : undefined;
  // Optical centering: with lineHeight:1 a numeral's glyph can sit slightly off
  // the box center (serifs like Cormorant carry descender space and read low;
  // sans like Orbitron read high). The caller-tuned `nudge` corrects it, applied
  // identically to the static layer and both leaf faces so the split halves stay
  // aligned during the fold.
  const Leaf = ({ digit, half, leafClass }) => (
    <div
      className={`ftile-leaf ${leafClass} absolute left-0 right-0 overflow-hidden ${
        half === 'top' ? 'top-0' : 'bottom-0'
      }`}
      aria-hidden="true"
      style={{ height: '50%' }}
    >
      {/* Full-height fill+digit, clipped by the leaf. No border/shadow (the
          static card behind provides the frame). */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center ${widthClass} ${textClass}`}
        style={{
          ...fillStyle,
          height: '200%',
          top: half === 'bottom' ? '-100%' : 0,
          lineHeight: 1,
          transform: nudge,
        }}
      >
        {digit}
      </div>
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden ${widthClass} ${className}`}
      style={style}
    >
      {/* Static layer — centered value visible at rest and underneath the
          folding leaves. While folding it shows the OLD value so the NEW value
          is revealed BY the flip (the bottom leaf), not ahead of it. Once the
          fold completes, `animating` is false and it shows the current value. */}
      <div
        className={`relative z-[3] flex items-center justify-center ${textClass}`}
        style={{ lineHeight: 1, transform: nudge }}
      >
        {animating ? prevValue : current}
      </div>

      {animating && (
        <>
          {/* Top leaf — OLD card's top half folds down (rotateX 0 -> -90). */}
          <Leaf digit={prevValue} half="top" leafClass="ftile-top" />
          {/* Bottom leaf — NEW card's bottom half folds up (rotateX 90 -> 0). */}
          <Leaf digit={current} half="bottom" leafClass="ftile-bottom" />
        </>
      )}

      {/* Center fold seam — the card's crease. Sits BELOW the digit (z-[1] vs the
          static digit's z-[3]) so it reads as a line behind the number, not one
          painted across it. The folding leaves (z-5) still cover it mid-flip. */}
      <span
        className="absolute left-1.5 right-1.5 top-1/2 h-px z-[1]"
        style={{ background: seamColor }}
      />

      <style>{`
        .ftile-leaf {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform-style: preserve-3d;
          z-index: 5;
        }
        .ftile-top {
          transform-origin: bottom center;
          animation: flip-top-down 0.45s ease-in forwards;
        }
        .ftile-bottom {
          transform-origin: top center;
          animation: flip-bottom-up 0.45s ease-out forwards;
        }
        @keyframes flip-top-down {
          0%   { transform: rotateX(0deg); }
          50%  { transform: rotateX(-90deg); }
          100% { transform: rotateX(-90deg); }
        }
        @keyframes flip-bottom-up {
          0%   { transform: rotateX(90deg); }
          50%  { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ftile-top,
          .ftile-bottom {
            animation: none;
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
