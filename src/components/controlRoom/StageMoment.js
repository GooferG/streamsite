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
  const [leaving, setLeaving] = useState(false);
  const staged = useRef({ pick: null, round: null });
  const now = useClock({ intervalMs: 250, active: !!moment && !leaving });
  const { setDucked } = cr;

  useEffect(() => {
    const m = giveawayMoment(giveaway, staged.current.pick, Date.now());
    if (!m) return;
    staged.current.pick = m.key;
    setLeaving(false);
    setMoment(m);
  }, [giveaway]);

  useEffect(() => {
    const m = resultsMoment(round, staged.current.round, Date.now());
    if (!m) return;
    staged.current.round = m.key;
    setLeaving(false);
    setMoment(m);
  }, [round]);

  const over = !!moment && (now >= moment.endsAt || !stillOnStage(moment, giveaway));
  useEffect(() => {
    if (over && !leaving) setLeaving(true);
  }, [over, leaving]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => {
      setMoment(null);
      setLeaving(false);
    }, prefersReducedMotion() ? MOTION.reducedFade : MOTION.powerOff);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    setDucked(!!moment);
  }, [moment, setDucked]);
  useEffect(() => () => setDucked(false), [setDucked]);

  useEffect(() => {
    if (!moment) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLeaving(true);
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
  } else if (moment.kind === 'results' && round) {
    body = (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 overflow-y-auto"
        style={{ background: 'radial-gradient(ellipse at center, rgba(9,9,11,0.7) 0%, rgba(9,9,11,0.94) 75%)' }}
      >
        <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-sm text-orange-admin">Prediction results</p>
        <h2 className="font-display text-white-body text-center leading-none" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}>
          {round.title}
        </h2>
        <div className="w-full max-w-4xl">
          <PredictionWinnersReveal round={round} />
        </div>
      </div>
    );
  }

  return createPortal(
    <div className={`cr-stage ${leaving ? 'cr-stage-out' : ''}`} onClick={() => setLeaving(true)} role="presentation">
      {body}
    </div>,
    document.body
  );
}
