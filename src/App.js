import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import Navigation from './components/Navigation';
import SiteFooter from './components/SiteFooter';
import GrainOverlay from './components/GrainOverlay';
import AdminLayout from './components/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import TVStaticIntro from './components/TVStaticIntro';
import HomePage from './pages/HomePage';
import GambaPage from './pages/GambaPage';
import { AuthProvider } from './contexts/AuthContext';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import { ControlRoomProvider } from './contexts/ControlRoomContext';
import StaffLayer from './components/controlRoom/StaffLayer';
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
import {
  introModeFor,
  readIntroFlags,
  markPowered,
  markSessionPlayed,
} from './utils/introMode';

// Lazy-loaded so they don't bloat the main bundle. Admin pages are gated to
// staff. Secondary public pages split per route. HomePage + GambaPage stay eager (landing paint / GambaPage
// already code-splits its own heavy children). TVStaticIntro is eager too: it
// is a few KB of raw WebGL and has to cover the very first paint.
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
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminModeratorsPage = lazy(() => import('./pages/AdminModeratorsPage'));
const StorePage = lazy(() => import('./pages/StorePage'));
const GiveawayPage = lazy(() => import('./pages/GiveawayPage'));
const MyAccountPage = lazy(() => import('./pages/MyAccountPage'));
const TwitchCallbackPage = lazy(() => import('./pages/TwitchCallbackPage'));
const DiscordCallbackPage = lazy(() => import('./pages/DiscordCallbackPage'));
const SuggestPage = lazy(() => import('./pages/SuggestPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const SuggestOverlay = lazy(() => import('./pages/SuggestOverlay'));
const GiveawayOverlay = lazy(() => import('./pages/GiveawayOverlay'));
const BattlePage = lazy(() => import('./pages/BattlePage'));

// Product/overlay routes render without the brand chrome (footer, brand body
// class). Everything else is a public brand page.
const PRODUCT_PREFIXES = [
  '/gamba',
  '/admin',
  '/twitch-callback',
  '/discord-callback',
  '/suggest-overlay',
];

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
  // Decided once per page load; see utils/introMode for the rules.
  const [intro] = useState(() => {
    const reduced =
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = introModeFor({
      pathname: location.pathname,
      isBrandRoute: !PRODUCT_PREFIXES.some((p) => location.pathname.startsWith(p)),
      reducedMotion: reduced,
      ...readIntroFlags(),
    });
    return { mode, reduced };
  });
  const [showTVIntro, setShowTVIntro] = useState(intro.mode !== 'none');
  const [signalLocking, setSignalLocking] = useState(false);

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

  // Page fades in under the static as the signal locks, not after it's gone.
  const handleIntroReveal = useCallback(() => {
    setIsVisible(true);
    setSignalLocking(true);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setShowTVIntro(false);
    setSignalLocking(false);
    setIsVisible(true);
    markSessionPlayed();
  }, []);

  const isBrandRoute = !PRODUCT_PREFIXES.some((p) =>
    location.pathname.startsWith(p)
  );

  useEffect(() => {
    document.body.classList.toggle('brand-route', isBrandRoute);
    return () => document.body.classList.remove('brand-route');
  }, [isBrandRoute]);

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
        <TVStaticIntro
          mode={intro.mode}
          reduced={intro.reduced}
          onPowerOn={markPowered}
          onReveal={handleIntroReveal}
          onComplete={handleIntroComplete}
        />
      )}

      <GrainOverlay />

      <Navigation
        currentPage={currentPage}
        setPage={(id) => navigate(id === 'home' ? '/' : `/${id}`)}
      />

      <StaffLayer isLive={isLive} streamData={streamData} pathname={location.pathname} />

      <main
        className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'} ${signalLocking ? 'motion-safe:animate-signal-lock' : ''}`}
      >
        <ErrorBoundary key={location.pathname}>
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
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
            <Route path="leaderboard" element={null} />
            <Route path="wheel" element={null} />
            <Route path="equity" element={null} />
            <Route path="hunts" element={null} />
            <Route path="bonus-battle" element={null} />
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
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="moderators" element={<AdminModeratorsPage />} />
          </Route>
          <Route path="/store" element={<StorePage />} />
          <Route path="/giveaway" element={<GiveawayPage />} />
          <Route path="/me" element={<MyAccountPage />} />
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/twitch-callback" element={<TwitchCallbackPage />} />
          <Route path="/discord-callback" element={<DiscordCallbackPage />} />
          <Route path="/suggest-overlay" element={<SuggestOverlay />} />
          <Route path="/battle/:ownerId" element={<BattlePage />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {isBrandRoute && <SiteFooter />}
    </div>
  );
}

// OBS browser sources render bare: no nav, grain, TV intro or Twitch polling,
// and nothing opaque behind them.
function AppShell() {
  const location = useLocation();
  if (location.pathname === '/giveaway-overlay') {
    return (
      <Suspense fallback={null}>
        <GiveawayOverlay />
      </Suspense>
    );
  }
  return <StreamingSiteContent />;
}

export default function StreamingSite() {
  return (
    <AuthProvider>
      <ControlRoomProvider>
        <TwitchAuthProvider>
          <AppShell />
        </TwitchAuthProvider>
      </ControlRoomProvider>
    </AuthProvider>
  );
}
