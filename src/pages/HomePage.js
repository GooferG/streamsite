import { useMemo, useState } from 'react';
import WelcomeSignOn from '../components/WelcomeSignOn';
import Couch from '../components/couch/Couch';
import useCouchData from '../components/couch/useCouchData';
import useTvReel from '../components/couch/useTvReel';

// Home: the couch (spec: docs/superpowers/specs/2026-10-04-couch-home-design.md).
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /?fixture=offair|live|giveaway|hunt|huntcad|round|late|loading|noart|empty|halloween
  // renders the couch from couchFixtures. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/couch/couchFixtures').COUCH_FIXTURES[key] || null;
  };
}

// Fixtures play the real local reel (public/tv/reel), so the TV's clips can be
// previewed without live data.
function FixtureCouch({ fixture }) {
  const reel = useTvReel();
  const input = useMemo(() => ({ ...fixture.input, reel: fixture.input.reel ?? reel }), [fixture, reel]);
  return <Couch input={input} noArt={!!fixture.noArt} />;
}

function LiveCouch({ introPullBack, introDone, ...twitch }) {
  const input = useCouchData(twitch);
  return <Couch input={input} introPullBack={introPullBack} introDone={introDone} />;
}

export default function HomePage({ introDone = true, introPullBack = false, ...twitch }) {
  const [fixture] = useState(readFixture);
  return (
    <>
      <WelcomeSignOn introDone={introDone} delayMs={introPullBack ? 1500 : 400} />
      {fixture ? (
        <FixtureCouch fixture={fixture} />
      ) : (
        <LiveCouch introPullBack={introPullBack} introDone={introDone} {...twitch} />
      )}
    </>
  );
}
