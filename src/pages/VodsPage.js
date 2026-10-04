import { useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import VideoStoreFront from '../components/vods/VideoStoreFront';
import useRecentClips from '../components/vods/useRecentClips';

// /vods: Goofer Video. Wires App's Twitch poll, the recent clips and the
// signed-in viewer into VideoStoreFront.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /vods?fixture=rich|live|fresh|classics|expiring|noclips|nothumb|empty|loading
  // renders the store from videoStoreFixtures. Webpack drops this branch, and
  // the fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/vods/videoStoreFixtures').VIDEO_STORE_FIXTURES[key] || null;
  };
}

const readTapeParam = () => new URLSearchParams(window.location.search).get('tape');

// The counter keeps ?tape= in the address bar so a tape can go in chat.
// replaceState: changing tapes adds no history entries.
function writeTapeParam(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('tape', id);
  else url.searchParams.delete('tape');
  window.history.replaceState(window.history.state, '', url);
}

function LiveStore({ videos, clips, loading, isLive, stream, statusReady }) {
  const { twitchUser } = useTwitchAuth();
  const recentClips = useRecentClips();
  const [initialTapeId] = useState(readTapeParam);
  return (
    <VideoStoreFront
      videos={videos}
      topClips={clips}
      recentClips={recentClips}
      loading={loading}
      isLive={isLive}
      stream={stream}
      statusReady={statusReady}
      viewerName={(twitchUser && twitchUser.displayName) || null}
      initialTapeId={initialTapeId}
      onTapeChange={writeTapeParam}
    />
  );
}

export default function VodsPage({ videos = [], clips = [], loading = false, isLive = false, stream = null, statusReady = false }) {
  const [fixture] = useState(readFixture);
  return (
    <div className="relative min-h-screen px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-6xl 2xl:max-w-7xl">
        {fixture ? (
          <VideoStoreFront {...fixture} />
        ) : (
          <LiveStore videos={videos} clips={clips} loading={loading} isLive={isLive} stream={stream} statusReady={statusReady} />
        )}
      </div>
    </div>
  );
}
