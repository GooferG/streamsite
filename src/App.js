import { useState, useEffect, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import Navigation from './components/Navigation';
import GrainOverlay from './components/GrainOverlay';
import LiveIndicator from './components/LiveIndicator';
import AdminLayout from './components/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import GambaPage from './pages/GambaPage';
import { AuthProvider } from './contexts/AuthContext';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import {
  getTwitchAccessToken,
  getTwitchUserId,
  getTwitchClips,
  getTwitchVideos,
  getTwitchStreamInfo,
  getTwitchChannelInfo,
  getTwitchFollowers,
  getGameNames,
} from './utils/twitchApi';

// Lazy-loaded so they don't bloat the main bundle. TVStaticIntro pulls in
// three.js + postprocessing (~145KB gzip) for a one-time intro most visitors
// skip; HuntSuggestPage pulls the full slot catalog; admin pages are gated to
// staff. Secondary public pages split per route. HomePage + GambaPage stay
// eager (landing paint / GambaPage already code-splits its own heavy children).
const TVStaticIntro = lazy(() => import('./components/TVStaticIntro'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const VodsPage = lazy(() => import('./pages/VodsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const GamingPage = lazy(() => import('./pages/GamingPage'));
const GearPage = lazy(() => import('./pages/Gear'));
const GearInteractive = lazy(() => import('./pages/GearInteractive'));
const AdminHubPage = lazy(() => import('./pages/AdminHubPage'));
const AdminSchedulePage = lazy(() => import('./pages/AdminSchedulePage'));
const AdminSuggestionsPage = lazy(() => import('./pages/AdminSuggestionsPage'));
const AdminStorePage = lazy(() => import('./pages/AdminStorePage'));
const AdminRedemptionsPage = lazy(() => import('./pages/AdminRedemptionsPage'));
const AdminTicketsPage = lazy(() => import('./pages/AdminTicketsPage'));
const AdminGiveawaysPage = lazy(() => import('./pages/AdminGiveawaysPage'));
const AdminHuntsPage = lazy(() => import('./pages/AdminHuntsPage'));
const AdminCommunityHuntsPage = lazy(() => import('./pages/AdminCommunityHuntsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminModeratorsPage = lazy(() => import('./pages/AdminModeratorsPage'));
const StorePage = lazy(() => import('./pages/StorePage'));
const GiveawayPage = lazy(() => import('./pages/GiveawayPage'));
const MyAccountPage = lazy(() => import('./pages/MyAccountPage'));
const TwitchCallbackPage = lazy(() => import('./pages/TwitchCallbackPage'));
const DiscordCallbackPage = lazy(() => import('./pages/DiscordCallbackPage'));
const SuggestPage = lazy(() => import('./pages/SuggestPage'));
const SuggestOverlay = lazy(() => import('./pages/SuggestOverlay'));
const LiveHuntPage = lazy(() => import('./pages/LiveHuntPage'));
const HuntSuggestPage = lazy(() => import('./pages/HuntSuggestPage'));

function StreamingSiteContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [channelData, setChannelData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [clips, setClips] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTVIntro, setShowTVIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.sessionStorage.getItem('tvIntroPlayed');
  });

  // Derive current page id from URL for nav highlighting
  const currentPage = location.pathname.split('/').filter(Boolean)[0] || 'home';

  useEffect(() => {
    const initTwitch = async () => {
      try {
        const token = await getTwitchAccessToken();
        const userId = await getTwitchUserId(token);

        const [clipsData, videosData, streamInfo, channelInfo, followersCount] =
          await Promise.all([
            getTwitchClips(token, userId),
            getTwitchVideos(token, userId),
            getTwitchStreamInfo(token, userId),
            getTwitchChannelInfo(token, userId),
            getTwitchFollowers(token, userId),
          ]);

        const gameIds = [
          ...clipsData.map((clip) => clip.game_id),
          ...videosData.map((video) => video.game_id),
        ].filter((id) => id);

        const gameNames = await getGameNames(token, gameIds);

        const enrichedClips = clipsData.map((clip) => ({
          ...clip,
          game_name: gameNames[clip.game_id] || clip.game_id || 'Various',
        }));

        const enrichedVideos = videosData.map((video) => ({
          ...video,
          game_name: gameNames[video.game_id] || video.game_id || 'Various',
        }));

        setClips(enrichedClips);
        setVideos(enrichedVideos);
        setIsLive(!!streamInfo);
        setStreamData(streamInfo);
        setChannelData({ ...channelInfo, followers: followersCount });
        setLoading(false);

        console.log('App.js Debug - Stream Info:', streamInfo);
        console.log('App.js Debug - isLive set to:', !!streamInfo);
      } catch (error) {
        console.error('Error initializing Twitch API:', error);
        setLoading(false);
      }
    };

    initTwitch();

    const interval = setInterval(initTwitch, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showTVIntro) {
      setIsVisible(true);
    }
  }, [showTVIntro]);

  const handleIntroComplete = () => {
    setShowTVIntro(false);
    setIsVisible(true);
    try {
      window.sessionStorage.setItem('tvIntroPlayed', '1');
    } catch {
      // sessionStorage may be unavailable (private mode, etc.)
    }
  };

  useEffect(() => {
    const productPrefixes = ['/gamba', '/admin', '/twitch-callback', '/discord-callback', '/suggest-overlay'];
    const isProduct = productPrefixes.some((p) => location.pathname.startsWith(p));
    document.body.classList.toggle('brand-route', !isProduct);
    return () => document.body.classList.remove('brand-route');
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const KONAMI = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'KeyB', 'KeyA',
    ];
    let buffer = [];
    const onKey = (e) => {
      const next = [...buffer, e.code];
      const expected = KONAMI.slice(0, next.length);
      const matches = next.every((c, i) => c === expected[i]);
      if (!matches) {
        buffer = KONAMI[0] === e.code ? [e.code] : [];
        return;
      }
      buffer = next;
      if (buffer.length === KONAMI.length) {
        buffer = [];
        navigate('/admin');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-broadcast text-white-body">
      {showTVIntro && (
        <Suspense fallback={null}>
          <TVStaticIntro onComplete={handleIntroComplete} />
        </Suspense>
      )}

      <GrainOverlay />

      <Navigation
        currentPage={currentPage}
        setPage={(id) => navigate(id === 'home' ? '/' : `/${id}`)}
      />

      <LiveIndicator isLive={isLive} streamData={streamData} />

      <main
        className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <ErrorBoundary key={location.pathname}>
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                Loading…
              </p>
            </div>
          }
        >
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                setPage={(id) => navigate(id === 'home' ? '/' : `/${id}`)}
                channelData={channelData}
                isLive={isLive}
                streamData={streamData}
                loading={loading}
                clips={clips}
                videos={videos}
                introDone={!showTVIntro}
              />
            }
          />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route
            path="/vods"
            element={
              <VodsPage videos={videos} clips={clips} loading={loading} />
            }
          />
          <Route path="/gear" element={<GearPage />} />
          <Route path="/gear-interactive" element={<GearInteractive />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/gamba" element={<GambaPage />}>
            <Route
              index
              element={<Navigate to="/gamba/leaderboard" replace />}
            />
            <Route path="leaderboard" element={null} />
            <Route path="wheel" element={null} />
            <Route path="equity" element={null} />
            <Route path="hunt" element={null} />
            <Route path="suggest" element={null} />
            <Route path="bonus-hunts" element={null} />
            <Route path="hunt-tracker" element={null} />
          </Route>
          <Route path="/gaming" element={<GamingPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="schedule" element={<AdminSchedulePage />} />
            <Route path="suggestions" element={<AdminSuggestionsPage />} />
            <Route path="store" element={<AdminStorePage />} />
            <Route path="redemptions" element={<AdminRedemptionsPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="giveaways" element={<AdminGiveawaysPage />} />
            <Route path="hunts" element={<AdminHuntsPage />} />
            <Route path="community-hunts" element={<AdminCommunityHuntsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="moderators" element={<AdminModeratorsPage />} />
          </Route>
          <Route path="/store" element={<StorePage />} />
          <Route path="/giveaway" element={<GiveawayPage />} />
          <Route path="/me" element={<MyAccountPage />} />
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/twitch-callback" element={<TwitchCallbackPage />} />
          <Route path="/discord-callback" element={<DiscordCallbackPage />} />
          <Route path="/suggest-overlay" element={<SuggestOverlay />} />
          <Route path="/live/:shareId" element={<LiveHuntPage />} />
          <Route path="/hunt-suggest/:linkId" element={<HuntSuggestPage />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

    </div>
  );
}

export default function StreamingSite() {
  return (
    <AuthProvider>
      <TwitchAuthProvider>
        <StreamingSiteContent />
      </TwitchAuthProvider>
    </AuthProvider>
  );
}
