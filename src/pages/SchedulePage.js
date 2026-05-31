import React, { useState, useEffect, useMemo } from 'react';
import { getGameCovers } from '../utils/igdbApi';
import { useSchedule } from '../hooks/useSchedule';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

const DAY_INDEX = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  'FRY-DAY': 5,
  FRIDAY: 5,
  SATURDAY: 6,
};

const WEEK_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
  'SUNDAY',
];

function dayAbbrev(day) {
  if (day === 'FRY-DAY') return 'FRI';
  return day.slice(0, 3);
}

function parseStartHour(timeString) {
  if (!timeString) return null;
  const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const meridiem = (match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour;
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

function StaticPattern() {
  return (
    <div
      className="w-full h-full"
      aria-hidden="true"
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, #18181b 0 2px, #27272a 2px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
        backgroundBlendMode: 'overlay',
      }}
    />
  );
}

function ScheduleRow({ item, coverUrl, isToday, isOff, isSpecial }) {
  const startHour = parseStartHour(item.time);

  return (
    <div
      className={`group grid grid-cols-[64px_88px_1fr] sm:grid-cols-[80px_112px_1fr_auto] gap-4 sm:gap-6 items-center py-5 border-t ${
        isToday ? 'border-emerald-signal/40' : 'border-white/8'
      } transition-colors duration-200`}
    >
      {/* Day cell */}
      <div className="flex flex-col gap-1">
        <span
          className={`text-[10px] font-bold tracking-eyebrow-lg ${
            isToday ? 'text-emerald-signal' : 'text-white/35'
          } font-mono`}
        >
          {dayAbbrev(item.day)}
        </span>
        <span
          className={`text-lg sm:text-xl font-black tracking-tight leading-none ${
            isOff ? 'text-white/35' : 'text-white-body'
          }`}
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {item.day === 'FRY-DAY'
            ? 'FRY'
            : dayAbbrev(item.day).charAt(0) +
              dayAbbrev(item.day).slice(1).toLowerCase()}
        </span>
      </div>

      {/* Cover / static slat */}
      <div className="w-16 h-22 sm:w-20 sm:h-28 overflow-hidden bg-zinc-card border border-white/8 flex-shrink-0">
        {isOff ? (
          <StaticPattern />
        ) : coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className={`w-full h-full object-cover ${isOff ? 'grayscale opacity-40' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold tracking-eyebrow-md text-white/30 font-mono">
            NO ART
          </div>
        )}
      </div>

      {/* Programming info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-md mb-1.5 font-mono">
          <span className={isOff ? 'text-white/30' : 'text-white/45'}>
            {isOff ? 'DARK' : item.time}
          </span>
          {startHour != null && !isOff && (
            <>
              <span className="text-white/15">·</span>
              <span className="text-white/35 tabular-nums">
                {String(startHour).padStart(2, '0')}:00
              </span>
            </>
          )}
          {isToday && (
            <>
              <span className="text-white/20">·</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-signal">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
                </span>
                TODAY
              </span>
            </>
          )}
        </div>
        <p
          className={`text-base sm:text-lg font-bold tracking-tight leading-snug ${
            isOff ? 'text-white/40' : 'text-white-body'
          } truncate`}
        >
          {item.content}
        </p>
        {item.gameName && !isOff && item.gameName !== item.content && (
          <p className="mt-1 text-[11px] tracking-eyebrow-sm uppercase text-white/40 truncate font-mono">
            {item.gameName}
          </p>
        )}
      </div>

      {/* Special tag */}
      {isSpecial && (
        <div className="hidden sm:block">
          <span className="inline-block px-2.5 py-1 border border-purple-gamba/50 text-[10px] font-bold tracking-eyebrow-md text-purple-bright font-mono">
            SPECIAL
          </span>
        </div>
      )}
    </div>
  );
}

function DarkWeekNotice() {
  return (
    <div className="border-t border-b border-white/8 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-24 h-32 sm:w-28 sm:h-36 overflow-hidden bg-zinc-card border border-white/8">
          <StaticPattern />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg text-white/40 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span>OFF AIR</span>
          <span className="text-white/15">·</span>
          <span>SIGNAL DARK</span>
        </div>
        <h2
          className="font-black leading-[0.9] tracking-[-0.03em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
          }}
        >
          No streams scheduled
          <br />
          this week.
        </h2>
        <p className="max-w-md text-sm sm:text-base text-white/70 leading-relaxed">
          The tower is quiet. Check back soon — or follow on Twitch for live
          alerts when the signal returns.
        </p>
      </div>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="grid grid-cols-[64px_88px_1fr] sm:grid-cols-[80px_112px_1fr_auto] gap-4 sm:gap-6 items-center py-5 border-t border-white/8">
      <div className="h-10 bg-zinc-card animate-pulse" />
      <div className="w-16 h-22 sm:w-20 sm:h-28 bg-zinc-card animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-32 bg-zinc-card animate-pulse" />
        <div className="h-5 w-56 bg-zinc-card animate-pulse" />
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { schedule, loading: scheduleLoading } = useSchedule();
  const [gameCovers, setGameCovers] = useState({});
  const [coversLoading, setCoversLoading] = useState(true);
  const now = useNowTimestamp();

  useEffect(() => {
    let cancelled = false;
    async function fetchCovers() {
      if (scheduleLoading) return;
      const gameNames = schedule
        .map((item) => item.gameName)
        .filter((name) => name);
      if (gameNames.length === 0) {
        if (!cancelled) setCoversLoading(false);
        return;
      }
      try {
        const covers = await getGameCovers(gameNames);
        if (!cancelled) setGameCovers(covers);
      } catch {
        // ignore — page still renders without covers
      } finally {
        if (!cancelled) setCoversLoading(false);
      }
    }
    fetchCovers();
    return () => {
      cancelled = true;
    };
  }, [schedule, scheduleLoading]);

  const orderedSchedule = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    return [...schedule].sort(
      (a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day)
    );
  }, [schedule]);

  const todayIndex = now.getDay();
  const isLoading = scheduleLoading || coversLoading;
  const allDark =
    !isLoading &&
    orderedSchedule.length > 0 &&
    orderedSchedule.every((item) => item.status === 'off');

  return (
    <div className="relative pt-32 pb-32 px-6 sm:px-10">
      <ScanlineOverlay />

      <div className="relative max-w-5xl mx-auto">
        {/* Slate header — programming guide */}
        <header className="mb-16 sm:mb-20">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span className="text-emerald-signal">ON AIR</span>
            </span>
            <span className="text-white/20">·</span>
            <span>PROGRAMMING GUIDE</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 tabular-nums">
              WK {Math.ceil(now.getDate() / 7)}
            </span>
          </div>

          <h1
            className="font-black leading-[0.82] tracking-[-0.035em] text-white-body select-none"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(3rem, 10vw, 6.5rem)',
            }}
          >
            <span className="block">This week,</span>
            <span className="block text-emerald-signal">on the air.</span>
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-eyebrow text-white/45 font-mono">
            <span>
              Zone · <span className="text-white/70">AZ / MST</span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Schedule ·{' '}
              <span className="text-white/70">Subject to change</span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Today ·{' '}
              <span className="text-emerald-signal tabular-nums">
                {formatTimecode(now)}
              </span>
            </span>
          </div>
        </header>

        {/* Schedule grid */}
        <section aria-label="Weekly schedule">
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => <LoadingRow key={i} />)
          ) : allDark ? (
            <DarkWeekNotice />
          ) : (
            orderedSchedule.map((item) => {
              const isToday = DAY_INDEX[item.day] === todayIndex;
              const isOff = item.status === 'off';
              const isSpecial = item.status === 'special';
              return (
                <ScheduleRow
                  key={item.day}
                  item={item}
                  coverUrl={item.gameName ? gameCovers[item.gameName] : null}
                  isToday={isToday}
                  isOff={isOff}
                  isSpecial={isSpecial}
                />
              );
            })
          )}
          {!allDark && <div className="border-t border-white/8" />}
        </section>

        {/* Footer note — minimal, no card */}
        <footer className="mt-16 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[10px] uppercase tracking-eyebrow-lg text-white/30 font-mono">
          <span>END OF GUIDE</span>
          <span className="text-white/15">·</span>
          <span className="text-white/50">
            Follow on{' '}
            <a
              href="https://twitch.tv/GooferG"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white-body hover:text-emerald-signal transition-colors"
            >
              TWITCH
            </a>{' '}
            for live alerts
          </span>
          <span className="text-white/15">·</span>
          <span className="text-emerald-signal/70 tabular-nums">
            {formatTimecode(now)}
          </span>
        </footer>
      </div>
    </div>
  );
}
