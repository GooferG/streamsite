import React, { useState } from 'react';
import { Twitch, Youtube, Twitter, ChevronLeft, ChevronRight } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

const STILLS = [
  { src: '/about/operator.jpg', caption: 'Still · The operator' },
  { src: '/about/rick-glassman.jpg', caption: 'Still · With Rick Glassman' },
];

// Photos piled like a deck of polaroids: the active card sits on top with a
// slight tilt, the rest peek out behind it. Prev/next swaps cards with a
// transform transition. Broken images drop out of the deck, so the page
// works before assets land in /public/about/.
function PhotoDeck() {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(() => new Set());
  const stills = STILLS.filter((s) => !broken.has(s.src));
  if (stills.length === 0) return null;

  const active = ((index % stills.length) + stills.length) % stills.length;
  const markBroken = (src) =>
    setBroken((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });

  return (
    <figure className="w-full max-w-[260px] mx-auto md:mx-0">
      <div className="relative aspect-[4/5]">
        {stills.map((still, i) => {
          // depth = how far behind the active card this one sits
          const depth = (i - active + stills.length) % stills.length;
          const isActive = depth === 0;
          return (
            <div
              key={still.src}
              aria-hidden={!isActive}
              className="absolute inset-0 overflow-hidden rounded-md border border-white/10 bg-zinc-card transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{
                transform: isActive
                  ? 'rotate(1.5deg)'
                  : `translate(${7 * depth}px, ${7 * depth}px) rotate(${-3 * depth}deg) scale(${1 - depth * 0.03})`,
                zIndex: stills.length - depth,
              }}
            >
              <img
                src={still.src}
                alt={still.caption}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  filter: 'saturate(0.85) contrast(1.05)',
                  objectPosition: 'center 30%',
                }}
                onError={() => markBroken(still.src)}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen"
                aria-hidden="true"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <figcaption className="text-[0.625rem] uppercase tracking-eyebrow-md text-white/40 font-mono min-w-0 truncate">
          {stills[active].caption}
        </figcaption>
        {stills.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              aria-label="Previous photo"
              className="p-1 border border-white/15 rounded-sm text-white/50 hover:text-emerald-signal hover:border-emerald-signal/50 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
            >
              <ChevronLeft size={13} aria-hidden="true" />
            </button>
            <span className="text-[0.625rem] tracking-eyebrow-sm text-white/35 font-mono tabular-nums">
              {active + 1}/{stills.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Next photo"
              className="p-1 border border-white/15 rounded-sm text-white/50 hover:text-emerald-signal hover:border-emerald-signal/50 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
            >
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </figure>
  );
}

function SegmentSlate({ index, label, title, accent = 'white' }) {
  const accentColor =
    accent === 'emerald' ? 'text-emerald-signal' : 'text-white-body';
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3 text-[0.625rem] sm:text-[0.6875rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-4 font-mono">
        <span className="text-white-body tabular-nums">{index}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/55">{label}</span>
      </div>
      <h2
        className={`font-black tracking-tight leading-none ${accentColor}`}
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 'clamp(1.875rem, 4.5vw, 3rem)',
        }}
      >
        {title}
      </h2>
    </header>
  );
}

function MetaRow({ k, v, accent = false }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-2 border-b border-white/5 text-[0.6875rem] uppercase tracking-eyebrow font-mono">
      <span className="text-white/40">{k}</span>
      <span className={accent ? 'text-emerald-signal' : 'text-white/75'}>
        {v}
      </span>
    </div>
  );
}

function ProgramLine({ slug, title, body }) {
  return (
    <article className="grid grid-cols-[auto_1fr] gap-5 sm:gap-7 py-5 border-t border-white/8">
      <div className="pt-1">
        <span className="block text-[0.625rem] font-bold tracking-eyebrow-md text-emerald-signal/80 font-mono">
          {slug}
        </span>
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-white-body tracking-tight mb-1.5">
          {title}
        </h3>
        <p className="text-sm sm:text-[0.9375rem] text-white/70 leading-relaxed max-w-2xl">
          {body}
        </p>
      </div>
    </article>
  );
}

function SignOffSocial({ icon, label, href, hostname }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 border-t border-white/10 hover:border-emerald-signal/50 transition-colors duration-200"
    >
      <span className="text-white/60 group-hover:text-emerald-signal transition-colors duration-200">
        {icon}
      </span>
      <span className="flex items-baseline gap-3 min-w-0">
        <span className="text-base font-bold tracking-tight text-white-body">
          {label}
        </span>
        <span className="text-[0.6875rem] tracking-eyebrow text-white/35 truncate font-mono">
          {hostname}
        </span>
      </span>
      <span className="text-[0.6875rem] font-bold tracking-eyebrow-lg text-white/40 group-hover:text-emerald-signal transition-colors duration-200 font-mono">
        TUNE IN →
      </span>
    </a>
  );
}

function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
      aria-hidden="true"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
      }}
    />
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function AboutPage() {
  const now = useNowTimestamp();

  return (
    <div className="relative pt-32 pb-32 px-6 sm:px-10">
      <ScanlineOverlay />

      <div className="relative max-w-4xl mx-auto">
        <main>
          {/* Slate header — the station ID */}
          <div className="mb-20 sm:mb-24">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] sm:text-[0.6875rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
                </span>
                <span className="text-emerald-signal">REC</span>
              </span>
              <span className="text-white/20">·</span>
              <span>STATION ID</span>
              <span className="text-white/20">·</span>
              <span className="text-white/30 tabular-nums">
                {formatTimecode(now, { frames: true })}
              </span>
            </div>

            <h1
              className="font-black leading-[0.82] tracking-[-0.035em] text-white-body select-none"
              style={{
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: 'clamp(3.25rem, 11vw, 7.5rem)',
              }}
            >
              <span className="block">The host</span>
              <span className="block text-emerald-signal">is a guy.</span>
            </h1>

            <p className="mt-8 max-w-xl text-base sm:text-lg text-white/65 leading-relaxed">
              Variety streamer out of Brazil, living in the heat of AZ. Mostly
              games. Sometimes slot machines. Occasionally a podcast that gets
              out of hand. The schedule is loose. The vibe is the point.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-12 max-w-2xl">
              <div>
                <MetaRow k="Operator" v="GOOFERG" accent />
                <MetaRow k="Location" v="Phoenix, AZ" />
              </div>
              <div>
                <MetaRow k="Languages" v="EN · PT-BR" />
                <MetaRow k="Hours" v="Late, Inconsistently Consistent" />
              </div>
            </div>
          </div>

          {/* Segment 01 — Who */}
          <section className="mb-20 sm:mb-24">
            <SegmentSlate
              index="01"
              label="Who"
              title="A chill Brazilian guy on the internet."
            />
            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-10 md:gap-16 items-start">
              <div className="space-y-5 text-[0.9375rem] sm:text-base text-white/75 leading-relaxed max-w-2xl">
                <p>
                  Streams are a mix of gaming with friends, story games at my
                  own pace, the occasional gamba session for the thrill, and
                  react content when something on the internet is louder than
                  the game I was going to play.
                </p>
                <p>
                  Off camera I'm doing the same things, minus the camera. The
                  channel exists to share that.
                </p>
              </div>
              <PhotoDeck />
            </div>
          </section>

          {/* Segment 02 — Programming */}
          <section className="mb-20 sm:mb-24">
            <SegmentSlate
              index="02"
              label="Programming"
              title="What's on the air."
              accent="emerald"
            />
            <div>
              <ProgramLine
                slug="P-01"
                title="Single-player &amp; sim"
                body="Yakuza, Nioh, Satisfactory, Arc Raiders, anything with a long progression curve. Management and simulation games stay on rotation; they're how I cool down."
              />
              <ProgramLine
                slug="P-02"
                title="Gamba"
                body="High-stakes slot sessions, treated strictly as entertainment. None of it is advice."
              />
              <ProgramLine
                slug="P-03"
                title="React &amp; just chatting"
                body="Reddit threads, YouTube videos, half-finished thoughts. Most chill block of the week; closer to a phone call than a show."
              />
              <div className="border-t border-white/8" />
            </div>
          </section>

          {/* Segment 03 — House rules */}
          <section className="mb-20 sm:mb-24">
            <SegmentSlate
              index="03"
              label="House rules"
              title="Three lines, then we're good."
            />
            <ol className="space-y-6 max-w-2xl">
              <li className="grid grid-cols-[auto_1fr] gap-5">
                <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1.5 font-mono">
                  01
                </span>
                <p className="text-[0.9375rem] sm:text-base text-white/80 leading-relaxed">
                  Toxicity isn't welcome. The chat is the room, so keep it a
                  room people want to be in.
                </p>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-5">
                <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1.5 font-mono">
                  02
                </span>
                <p className="text-[0.9375rem] sm:text-base text-white/80 leading-relaxed">
                  Lurking is fine. Chatting is fine. Eating dinner with the
                  stream on in the background is more than fine.
                </p>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-5">
                <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1.5 font-mono">
                  03
                </span>
                <p className="text-[0.9375rem] sm:text-base text-white/80 leading-relaxed">
                  Don't be a cunt.
                </p>
              </li>
            </ol>
          </section>

          {/* Sign off — socials */}
          <section>
            <SegmentSlate
              index="04"
              label="Sign-off"
              title="Find the rest of the signal."
            />
            <div className="max-w-2xl">
              <SignOffSocial
                icon={<Twitch size={18} aria-hidden="true" />}
                label="Twitch"
                href={SOCIAL_LINKS.twitch}
                hostname={safeHostname(SOCIAL_LINKS.twitch)}
              />
              <SignOffSocial
                icon={<Youtube size={18} aria-hidden="true" />}
                label="YouTube"
                href={SOCIAL_LINKS.youtube}
                hostname={safeHostname(SOCIAL_LINKS.youtube)}
              />
              <SignOffSocial
                icon={<Twitter size={18} aria-hidden="true" />}
                label="Twitter"
                href={SOCIAL_LINKS.twitter}
                hostname={safeHostname(SOCIAL_LINKS.twitter)}
              />
              <div className="border-t border-white/10" />
            </div>

            <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] uppercase tracking-eyebrow-lg text-white/30 font-mono">
              <span>END OF TRANSMISSION</span>
              <span className="text-white/15">·</span>
              <span className="text-white/50">REEL #A-013</span>
            </div>
            <p className="mt-3 text-[0.625rem] uppercase tracking-eyebrow-md text-white/25 font-mono">
              The signal repeats nightly until the operator sleeps.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
