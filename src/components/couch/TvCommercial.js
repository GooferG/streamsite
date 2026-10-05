import { useState } from 'react';
import { MONO } from '../onAir/classes';
import GsnBug from '../store/GsnBug';
import { COMMERCIALS } from './commercials';

// A commercial on the couch TV (copy and art in commercials.js). A few beats
// cut together inside AD_MS: images with a slow push-in, words that step in,
// a lower-third. Every move is a motion-safe CSS keyframe on transform or
// opacity, timed by its inline delay in seconds. `still` (reduced motion)
// draws the key frame alone: key image, headline, lower-third. Decorative,
// like the whole TV: the TV door's link says what is on.

const FULL = 'absolute inset-0 h-full w-full object-cover';
const moving = (still, cls) => (still ? '' : cls);
const at = (still, delay, duration) =>
  still ? undefined : { animationDelay: `${delay}s`, ...(duration ? { animationDuration: `${duration}s` } : {}) };

// A dead image unrenders, never a broken glyph; a new src gets a fresh try.
function AdImage({ src, className, style, testId }) {
  const [failed, setFailed] = useState(null);
  if (failed === src) return null;
  return <img src={src} alt="" draggable={false} onError={() => setFailed(src)} className={className} style={style} data-testid={testId} />;
}

function Headline({ children, place = 'top', className = '', style }) {
  const spot = place === 'top' ? 'top-[5cqw]' : 'bottom-[15cqw]';
  return (
    <p className={`absolute inset-x-[5cqw] ${spot} ${className}`} style={style}>
      <span className="box-decoration-clone bg-onair-surface-4/90 px-[2cqw] font-onair text-[max(10px,6.4cqw)] font-extrabold leading-[1.35] tracking-[-0.02em] text-onair-ink-1">
        {children}
      </span>
    </p>
  );
}

function LowerThird({ ad, still, delay, cta = null, className = 'absolute inset-x-0 bottom-0' }) {
  return (
    <div
      data-testid="tv-ad-lower"
      className={`${className} flex items-center gap-[2.5cqw] bg-onair-surface-4/90 px-[4cqw] py-[2.4cqw] shadow-onair-row ${moving(still, 'motion-safe:animate-tv-ad-in')}`}
      style={at(still, delay)}
    >
      {ad.name === 'GSN' ? (
        <GsnBug size="tv" />
      ) : (
        <span className="font-onair text-[max(10px,4.4cqw)] font-extrabold tracking-[-0.01em] text-onair-ink-1">{ad.name}</span>
      )}
      <span className={`${MONO} text-[max(10px,3.4cqw)] tracking-[0.15em] text-onair-ink-2`}>{ad.url}</span>
      {cta && (
        <span
          className={`ml-auto rounded-onair-tile bg-onair-signal px-[2.5cqw] py-[1cqw] font-onair text-[max(10px,3.6cqw)] font-bold text-onair-surface-4 ${moving(still, 'motion-safe:animate-crt-blink')}`}
        >
          {cta}
        </span>
      )}
    </div>
  );
}

// GSN: the ident (0 to 1.4s), the operator standing by (key frame), then the
// lineup popping in one by one (from 4.4s) to "Spend your tickets."
function GsnAd({ ad, still }) {
  const { art, lines } = ad;
  return (
    <>
      <AdImage
        testId="tv-ad-key"
        src={art.key}
        className={`${FULL} object-[50%_30%] ${moving(still, 'motion-safe:animate-tv-ad-push')}`}
        style={at(still, 1.4, 3)}
      />
      <Headline place="bottom" className={moving(still, 'motion-safe:animate-tv-ad-in')} style={at(still, 1.7)}>
        {lines.hook}
      </Headline>
      {!still && (
        <>
          <div className="absolute inset-0 bg-onair-surface-3 opacity-0 motion-safe:animate-tv-ad-cut" style={at(false, 4.4)}>
            <Headline className="motion-safe:animate-tv-ad-in" style={at(false, 5.9)}>
              {lines.pitch}
            </Headline>
            <div className="absolute inset-x-[5cqw] top-[22cqw] grid grid-cols-3 gap-[3cqw]">
              {art.items.map((src, i) => (
                <span
                  key={src}
                  className="aspect-[4/3] overflow-hidden rounded-onair-tile bg-onair-surface-1 shadow-onair-row motion-safe:animate-tv-ad-pop"
                  style={at(false, 4.6 + i * 0.4)}
                >
                  <AdImage src={src} className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 opacity-0 motion-safe:animate-tv-ad-hold">
            <AdImage src={art.ident} className={`${FULL} motion-safe:animate-tv-ad-push`} style={at(false, 0, 1.4)} />
            <span className="absolute inset-x-0 top-[22%] flex justify-center motion-safe:animate-tv-ad-pop" style={at(false, 0.15)}>
              <GsnBug size="ident" />
            </span>
          </div>
        </>
      )}
      <LowerThird ad={ad} still={still} delay={1.4} cta={lines.cta} />
    </>
  );
}

// Goofer Video: the clerk restocking (key frame), then asleep at the counter
// from 4s.
function VideoAd({ ad, still }) {
  const { art, lines } = ad;
  return (
    <>
      <AdImage
        testId="tv-ad-key"
        src={art.key}
        className={`${FULL} object-[50%_35%] ${moving(still, 'motion-safe:animate-tv-ad-push')}`}
        style={at(still, 0, 4)}
      />
      <Headline place="bottom" className={moving(still, 'motion-safe:animate-tv-ad-in')} style={at(still, 0.3)}>
        {lines.hook}
      </Headline>
      {!still && (
        <div className="absolute inset-0 opacity-0 motion-safe:animate-tv-ad-cut" style={at(false, 4)}>
          <AdImage src={art.tag} className={`${FULL} object-[50%_60%] motion-safe:animate-tv-ad-push`} style={at(false, 4, 4)} />
          <Headline place="bottom" className="motion-safe:animate-tv-ad-in" style={at(false, 4.4)}>
            {lines.tag}
          </Headline>
        </div>
      )}
      <LowerThird ad={ad} still={still} delay={0.7} />
    </>
  );
}

// Goofer Guide: the next shows crawl up a Prevue-style grid, then sit.
function GuideAd({ ad, listings, still }) {
  const cell = `${MONO} text-[max(10px,3cqw)] leading-[1.25] tracking-[0.15em]`;
  return (
    <div className="couch-ad-guide absolute inset-0 flex flex-col">
      <div className="couch-ad-guide-head flex items-baseline justify-between gap-[2cqw] px-[4cqw] py-[2.2cqw]">
        <span className="font-onair text-[max(10px,5.6cqw)] font-extrabold tracking-[-0.02em] text-onair-ink-1">{ad.name}</span>
        <span className={`${MONO} text-[max(10px,3cqw)] tracking-[0.2em] text-onair-ink-2`}>{ad.lines.kicker}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden px-[3cqw] pt-[2cqw]">
        <ol className={`flex min-h-full flex-col gap-[1.2cqw] ${moving(still, 'motion-safe:animate-tv-ad-crawl')}`} style={at(still, 0.2)}>
          {listings.map((l, i) => (
            <li key={`${i}-${l.day}-${l.time}`} data-testid="tv-ad-listing" className="grid grid-cols-[30cqw_minmax(0,1fr)] gap-[1.2cqw]">
              <span className="couch-ad-guide-cell flex flex-col justify-center px-[2.4cqw] py-[1.2cqw]">
                <span className={`${cell} text-onair-ink-2`}>{l.day}</span>
                <span className={`${cell} text-onair-ink-1`}>{l.time}</span>
              </span>
              <span className="couch-ad-guide-cell flex items-center px-[2.4cqw] py-[1.2cqw] font-onair text-[max(10px,4.6cqw)] font-bold leading-tight text-onair-ink-1">
                {l.show}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <LowerThird ad={ad} still={still} delay={0.4} className="relative" />
    </div>
  );
}

export default function TvCommercial({ item, still = false }) {
  const ad = COMMERCIALS[item.ad];
  if (!ad) return null;
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-onair-surface-4 font-onair"
      data-testid="tv-ad"
      data-ad={item.ad}
      data-still={still ? 'true' : undefined}
    >
      {item.ad === 'gsn' && <GsnAd ad={ad} still={still} />}
      {item.ad === 'video' && <VideoAd ad={ad} still={still} />}
      {item.ad === 'guide' && <GuideAd ad={ad} listings={item.listings || []} still={still} />}
    </div>
  );
}
