import React from 'react';
import { useNowTimestamp, formatTimecode } from '../utils/timecode';

// Sections mirror the broadcast register used across the brand pages
// (AboutPage / Leaderboard): mono eyebrows, emerald accents, no chrome.
const SECTIONS = [
  {
    index: '01',
    label: 'Eligibility',
    title: 'Who can play.',
    clauses: [
      'You must be of legal age and in a legal location to participate.',
      'Limit one account per person across the site, Discord, Twitch, and related reward systems.',
      'Duplicate, shared, misleading, automated, or abusive accounts may be denied entry or removed.',
    ],
  },
  {
    index: '02',
    label: 'Claim',
    title: 'Getting paid out.',
    clauses: [
      'You must be verified before any winner, prize, reward, payout, or redemption can be approved.',
      'Verification can take time and may require additional review or information.',
      'Winning does not guarantee approval or payment until eligibility and prize details are reviewed.',
    ],
  },
  {
    index: '03',
    label: 'Opt-In',
    title: 'You start the clock.',
    clauses: [
      'Raffle ticket earning, shop token earning, and token shop redemptions start only after you opt in to the related site program.',
      'Prior activity, wager, messages, or account history may not be credited retroactively.',
    ],
  },
  {
    index: '04',
    label: 'Earning',
    title: 'Rates can move.',
    clauses: [
      'Ticket and token rates, cooldowns, activity requirements, wager requirements, and earning availability may change.',
      'Balances can be reviewed, corrected, adjusted, or removed if an error, abuse, fraud, duplicate account, or eligibility issue is found.',
    ],
  },
  {
    index: '05',
    label: 'Fair Use',
    title: 'Don’t game the games.',
    clauses: [
      'Automated abuse, spam, duplicate accounts, misleading identity information, evasion, chargebacks, or attempts to manipulate rewards may result in removal from entries, forfeiture of balances, denial of prizes, or account restrictions.',
    ],
  },
  {
    index: '06',
    label: 'Prizes',
    title: 'At payer discretion.',
    clauses: [
      'All rewards and prizes are subject to change and are at payer discretion.',
      'Winners, prizes, rewards, redemptions, and payouts from site, Discord, Twitch, or related community activities are subject to denial, review, and approval.',
      'If a prize, reward, tip, or payout is sent in error or exceeds the approved amount, you agree to return the mistaken or excess amount upon request.',
      'Administrative decisions on eligibility, winner validation, prize fulfillment, redemptions, and account status are final.',
      'Programs may be paused, changed, limited, or ended at any time.',
    ],
  },
  {
    index: '07',
    label: 'Privacy',
    title: 'What your data is for.',
    clauses: [
      'Profile data is used for verification, claiming prizes, fraud detection, and scam detection.',
    ],
  },
];

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

function ClauseSection({ index, label, title, clauses }) {
  return (
    <section className="mb-16 sm:mb-20">
      <header className="mb-6">
        <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-4 font-mono">
          <span className="text-white/30">CLAUSE</span>
          <span className="text-white-body tabular-nums">{index}</span>
          <span className="text-white/20">·</span>
          <span className="text-white/55">{label}</span>
        </div>
        <h2
          className="font-black tracking-tight leading-none text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
          }}
        >
          {title}
        </h2>
      </header>
      <ol className="space-y-5 max-w-2xl">
        {clauses.map((clause, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr] gap-5">
            <span className="text-emerald-signal text-xs font-bold tracking-eyebrow-lg pt-1 font-mono tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-[15px] sm:text-base text-white/75 leading-relaxed">
              {clause}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function TermsPage() {
  const now = useNowTimestamp();

  return (
    <div className="relative pt-32 pb-32 px-6 sm:px-10">
      <ScanlineOverlay />

      <div className="relative max-w-3xl mx-auto">
        {/* Slate header */}
        <div className="mb-16 sm:mb-20">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono">
            <span>THE FINE PRINT</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 tabular-nums">
              {formatTimecode(now, { frames: true })}
            </span>
          </div>

          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body select-none"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.75rem, 9vw, 5.5rem)',
            }}
          >
            <span className="block">Terms &amp;</span>
            <span className="block text-emerald-signal">Conditions</span>
          </h1>

          <p className="mt-8 max-w-2xl text-base sm:text-lg text-white/65 leading-relaxed">
            These terms apply to all site and Discord activities that may result
            in prizes, rewards, giveaways, raffles, redemptions, or payouts. By
            taking part, you agree to them.
          </p>
        </div>

        {SECTIONS.map((s) => (
          <ClauseSection key={s.index} {...s} />
        ))}

        {/* Gambling disclaimer — same line shown on the leaderboard pages */}
        <p className="mt-4 px-1 text-center text-[10px] font-bold tracking-eyebrow-sm uppercase font-mono text-white/35">
          We do not take responsibility for any losses from gambling. Play
          responsibly. Must be 18+.
        </p>
      </div>
    </div>
  );
}
