import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { useGiveawayFeed } from '../../hooks/useGiveawayFeed';
import { useClock } from '../../hooks/useClock';
import { pickKey } from '../../utils/giveaway';
import { CrtStyles } from '../giveaway/RevealScreen';
import RevealStage from '../giveaway/RevealStage';
import PredictionWinnersReveal from '../PredictionWinnersReveal';
import { giveawayMoment, resultsMoment } from './stageTriggers';
import { MOTION, prefersReducedMotion } from './motion';
import './controlRoom.css';

function stillOnStage(moment, giveaway) {
  if (!moment || moment.kind !== 'giveaway') return true;
  return !!giveaway && pickKey(giveaway) === moment.key && ['rolling', 'playing'].includes(giveaway.status);
}

// Full-screen reveal over the page on the streaming browser (Stage on): the
// same reveal the OBS overlay shows for a pick, and a title card plus the
// winners for a settle. Ducks the panel while it plays.
export default function StageMoment() {
  const cr = useControlRoom();
  const giveaway = cr.giveaway;
  const round = cr.latestRound;
  const feed = useGiveawayFeed({ enabled: true });
  const sameGiveaway = !!giveaway && feed.giveaway?.id === giveaway.id;
  const [moment, setMoment] = useState(null);
  // Keyed to the moment it belongs to: a new moment (a reroll, a fresh
  // settle) is never born already leaving just because the previous one was
  // on its way out when it arrived.
  const [leavingKey, setLeavingKey] = useState(null);
  const staged = useRef({ pick: null, round: null });
  const leaving = !!moment && leavingKey === moment.key;
  const now = useClock({ intervalMs: 250, active: !!moment && !leaving });
  const { setDucked } = cr;

  useEffect(() => {
    const m = giveawayMoment(giveaway, staged.current.pick, Date.now());
    if (!m) return;
    staged.current.pick = m.key;
    setMoment(m);
  }, [giveaway]);

  useEffect(() => {
    const m = resultsMoment(round, staged.current.round, Date.now());
    if (!m) return;
    staged.current.round = m.key;
    setMoment(m);
  }, [round]);

  const over = !!moment && (now >= moment.endsAt || !stillOnStage(moment, giveaway));
  useEffect(() => {
    if (over && !leaving) setLeavingKey(moment.key);
  }, [over, leaving, moment]);

  useEffect(() => {
    if (!leaving) return undefined;
    const key = moment.key;
    const t = setTimeout(() => {
      // Only clear it if it's still the moment that was leaving: a new one
      // may already have taken its place.
      setMoment((current) => (current && current.key === key ? null : current));
    }, prefersReducedMotion() ? MOTION.reducedFade : MOTION.powerOff);
    return () => clearTimeout(t);
  }, [leaving, moment]);

  useEffect(() => {
    setDucked(!!moment);
  }, [moment, setDucked]);
  useEffect(() => () => setDucked(false), [setDucked]);

  useEffect(() => {
    if (!moment) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLeavingKey(moment.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moment]);

  if (!moment) return null;

  let body = null;
  if (moment.kind === 'giveaway' && giveaway) {
    const name = giveaway.winner?.displayName || giveaway.winner?.twitchName;
    body = (
      <>
        <CrtStyles />
        <div aria-hidden="true">
          <RevealStage
            giveaway={giveaway}
            entries={sameGiveaway ? feed.entries : []}
            firstMessage={sameGiveaway ? feed.firstMessage : null}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          Giveaway winner: {name}
        </p>
      </>
    );
  } else if (moment.kind === 'results' && moment.round) {
    body = (
      <>
        <div
          aria-hidden="true"
          className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 overflow-y-auto"
          style={{ background: 'radial-gradient(ellipse at center, rgba(9,9,11,0.7) 0%, rgba(9,9,11,0.94) 75%)' }}
        >
          <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-sm text-orange-admin">Prediction results</p>
          <h2 className="font-display text-white-body text-center leading-none" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
            {moment.round.title}
          </h2>
          <div className="w-full max-w-4xl">
            <PredictionWinnersReveal round={moment.round} />
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          Prediction results: {moment.round.title}
        </p>
      </>
    );
  }

  return createPortal(
    <div className={`cr-stage ${leaving ? 'cr-stage-out' : ''}`} onClick={() => setLeavingKey(moment.key)} role="presentation">
      {body}
    </div>,
    document.body
  );
}
