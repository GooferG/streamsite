const SPONSORS = [
  "THIS BROADCAST BROUGHT TO YOU BY UNCLE LARRY'S DISCOUNT BACKHOES",
  'GET HIM ON THE CB · CHANNEL 19 · KEEP IT WIDE OPEN',
  'STAY TUNED FOR THE LATE-NIGHT WAGER REPORT',
  'WE NOW RETURN YOU TO YOUR REGULARLY SCHEDULED STANDINGS',
  'PUBLIC ACCESS · COMMUNITY FUNDED · ABSOLUTELY UNAUTHORIZED',
  'IF YOUR TV IS SMOKING THAT IS NORMAL',
  'MOCK DATA · ENTERTAINMENT ONLY · NO ACTUAL PAYOUT',
  'TAPE WAS REWOUND BY HAND',
  'PLEASE STAND BY · STANDINGS REFRESH AT IRREGULAR INTERVALS',
  'PROUDLY BROADCASTING FROM A BASEMENT IN AN UNDISCLOSED CITY',
  'NO PURCHASE NECESSARY · NO PRIZE NECESSARY EITHER',
  'GOOFER TV · WHERE THE NUMBERS GO UP AND ALSO SOMETIMES DOWN',
];

export default function TickerCrawl() {
  // Duplicate the content so the marquee loops seamlessly.
  const line = SPONSORS.join('   ·   ');

  return (
    <div
      className="relative overflow-hidden border-t border-white/8 bg-zinc-broadcast/60"
      aria-hidden="true"
    >
      <div className="ticker-track whitespace-nowrap py-2.5 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono motion-reduce:[animation:none]">
        <span className="px-6">{line}</span>
        <span className="px-6">{line}</span>
      </div>
      <style>{`
        @keyframes leaderboard-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          min-width: 200%;
          animation: leaderboard-ticker 40s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
