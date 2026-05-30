import React from 'react';
import { Twitch, Youtube, Twitter } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

function StationRail({ now }) {
  return (
    <aside
      className="font-mono hidden lg:flex flex-col gap-8 sticky top-32 self-start text-[10px] uppercase tracking-eyebrow-md text-white/40"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1">
        <span className="text-white/30">Station</span>
        <span className="text-white-body text-xs tracking-eyebrow-lg">
          GG-01
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-white/30">Tape</span>
        <span className="text-white/70 text-xs tracking-eyebrow-lg">
          #A-013
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-white/30">Format</span>
        <span className="text-white/70 text-xs tracking-eyebrow-lg">
          UHD / 1440p60
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-white/30">Region</span>
        <span className="text-white/70 text-xs tracking-eyebrow-lg">
          BR · GLOBAL
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-white/30">Timecode</span>
        <span className="text-emerald-signal text-xs tracking-eyebrow-sm tabular-nums">
          {formatTimecode(now, { frames: true })}
        </span>
      </div>
      <div className="mt-2 w-12 h-px bg-white/15" />
      <div className="flex flex-col gap-3 text-[9px] leading-relaxed text-white/30">
        <span>This is a continuous</span>
        <span>broadcast. The signal</span>
        <span>repeats nightly until</span>
        <span>the operator sleeps.</span>
      </div>
    </aside>
  );
}

function SegmentSlate({ index, label, title, accent = 'white' }) {
  const accentColor =
    accent === 'emerald' ? 'text-emerald-signal' : 'text-white-body';
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-4 font-mono">
        <span className="text-white/30">SEGMENT</span>
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
    <div className="grid grid-cols-[120px_1fr] gap-4 py-2 border-b border-white/5 text-[11px] uppercase tracking-eyebrow font-mono">
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
        <span className="block text-[10px] font-bold tracking-eyebrow-md text-emerald-signal/80 font-mono">
          {slug}
        </span>
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-white-body tracking-tight mb-1.5">
          {title}
        </h3>
        <p className="text-sm sm:text-[15px] text-white/70 leading-relaxed max-w-2xl">
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
        <span className="text-[11px] tracking-eyebrow text-white/35 truncate font-mono">
          {hostname}
        </span>
      </span>
      <span className="text-[11px] font-bold tracking-eyebrow-lg text-white/40 group-hover:text-emerald-signal transition-colors duration-200 font-mono">
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

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[140px_1fr] gap-12 lg:gap-20">
        <StationRail now={now} />

        <main>
          {/* Slate header — the station ID */}
          <div className="mb-20 sm:mb-24">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono">
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
                <MetaRow k="Languages" v="EN · PT-BR" />
              </div>
              <div>
                <MetaRow k="Hours" v="Late, Inconsistently Consistent" />
                <MetaRow k="Format" v="Variety" />
                <MetaRow k="Status" v="On the air" accent />
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
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-start">
              <div className="space-y-5 text-[15px] sm:text-base text-white/75 leading-relaxed max-w-2xl">
                <p>
                  Streams are a mix of gaming with friends, story games at my
                  own pace, the occasional gamba session for the thrill, and
                  react content when something on the internet is louder than
                  the game I was going to play.
                </p>
                <p>
                  Off camera I'm doing the same things, minus the camera. The
                  point of the channel is to share that — not to perform.
                </p>
              </div>
              <div className="hidden md:flex flex-col gap-2 text-[10px] uppercase tracking-eyebrow-md text-white/35 border-l border-white/10 pl-6 font-mono">
                <span>RUN TIME</span>
                <span className="text-white/65 text-xs tracking-eyebrow-lg">
                  ~4 HR
                </span>
                <span className="mt-3">CADENCE</span>
                <span className="text-white/65 text-xs tracking-eyebrow-lg">
                  5/WK
                </span>
              </div>
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
                body="High-stakes slot sessions. Played as entertainment, framed as entertainment, treated as entertainment. Not advice, not a strategy, not a plan."
              />
              <ProgramLine
                slug="P-03"
                title="React &amp; just chatting"
                body="Reddit threads, YouTube videos, half-finished thoughts. Most chill block of the week — closer to a phone call than a show."
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
                <p className="text-[15px] sm:text-base text-white/80 leading-relaxed">
                  Toxicity isn't welcome. The chat is the room — keep it a room
                  people want to be in.
                </p>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-5">
                <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1.5 font-mono">
                  02
                </span>
                <p className="text-[15px] sm:text-base text-white/80 leading-relaxed">
                  Lurking is fine. Chatting is fine. Eating dinner with the
                  stream on in the background is more than fine.
                </p>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-5">
                <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1.5 font-mono">
                  03
                </span>
                <p className="text-[15px] sm:text-base text-white/80 leading-relaxed">
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

            <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] uppercase tracking-eyebrow-lg text-white/30 font-mono">
              <span>END OF TRANSMISSION</span>
              <span className="text-white/15">·</span>
              <span className="text-white/50">REEL #A-013</span>
              <span className="text-white/15">·</span>
              <span className="text-emerald-signal/70 tabular-nums">
                {formatTimecode(now, { frames: true })}
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
