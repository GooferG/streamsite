import { useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import useCommunityHunts from '../hooks/useCommunityHunts';
import usePredictionRound from '../components/hunts/usePredictionRound';
import useRoundEntries from '../components/hunts/useRoundEntries';
import useMyEntry from '../components/hunts/useMyEntry';
import HuntsTab from '../components/hunts/HuntsTab';

// /gamba/hunts: wires live data into the On Air Hunts tab.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /gamba/hunts?fixture=open|open-staff|locked|settled|offair renders
  // the tab from the handoff's mock data. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/hunts/huntFixtures').HUNT_FIXTURES[key] || null;
  };
}

function LiveHuntsTab() {
  const round = usePredictionRound();
  const { entries, sealed } = useRoundEntries(round);
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const myEntry = useMyEntry(round && round.id, twitchUser && twitchUser.twitchId);
  const { live, recent } = useCommunityHunts();
  return (
    <HuntsTab
      round={round}
      entries={entries}
      sealed={sealed}
      myEntry={myEntry}
      viewer={twitchUser}
      onSignIn={loginWithTwitch}
      live={live}
      recent={recent}
    />
  );
}

export default function HuntsPage() {
  const [fixture] = useState(readFixture);
  return fixture ? <HuntsTab {...fixture} onSignIn={() => {}} /> : <LiveHuntsTab />;
}
