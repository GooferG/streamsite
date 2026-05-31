import HomeLeaderboardCallout from './HomeLeaderboardCallout';
import HomeGambaTools from './HomeGambaTools';

// The /gamba hub landing: leaderboard hero on top, tool grid below.
// `setPage(id)` matches GambaPage's nav convention (e.g. setPage('gamba/wheel')).
export default function GambaHub({ setPage }) {
  return (
    <div>
      <HomeLeaderboardCallout />
      <HomeGambaTools
        setPage={setPage}
        sectionId="gamba-hub-tools"
        className="pt-4 pb-8"
        innerClassName=""
        segment={null}
        eyebrow="The gamba wing"
        title="Pick a tool"
      />
    </div>
  );
}
