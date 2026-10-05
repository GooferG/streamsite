import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import Navigation from './components/nav/Navigation';
import HomeMenuButton from './components/nav/HomeMenuButton';
import SiteFooter from './components/SiteFooter';
import GrainOverlay from './components/GrainOverlay';
import AdminLayout from './components/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import TVStaticIntro from './components/TVStaticIntro';
import CameraProvider from './components/camera/CameraProvider';
import HomePage from './pages/HomePage';
import GambaPage from './pages/GambaPage';
import { AuthProvider } from './contexts/AuthContext';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import { ControlRoomProvider } from './contexts/ControlRoomContext';
import StaffLayer from './components/controlRoom/StaffLayer';
import { PAGE_LOADERS } from './routes/loaders';
import { titleFor } from './routes/pageTitles';
import {
  dropTwitchToken,
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
const SchedulePage = lazy(PAGE_LOADERS.schedule);
const VodsPage = lazy(PAGE_LOADERS.vods);
const AboutPage = lazy(PAGE_LOADERS.about);
const GamingPage = lazy(PAGE_LOADERS.gaming);
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
const StorePage = lazy(PAGE_LOADERS.store);
const GiveawayPage = lazy(PAGE_LOADERS.giveaway);
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
  const navType = useNavigationType();
  const [channelData, setChannelData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [clips, setClips] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  // True once a Twitch poll has succeeded, so the nav never claims "off air"
  // when it simply couldn't reach Twitch.
  const [statusReady, setStatusReady] = useState(false);
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
  // With no intro the page is up from the first paint (no fade from black).
  const [isVisible, setIsVisible] = useState(intro.mode === 'none');
  const [signalLocking, setSignalLocking] = useState(false);

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
        setStatusReady(true);
        setStreamData(streamInfo);
        setChannelData({ ...channelInfo, followers: followersCount });
        setLoading(false);

        console.log('App.js Debug - Stream Info:', streamInfo);
        console.log('App.js Debug - isLive set to:', !!streamInfo);
      } catch (error) {
        console.error('Error initializing Twitch API:', error);
        dropTwitchToken();
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

  // The tab says which page this is.
  useEffect(() => {
    document.title = titleFor(location.pathname);
  }, [location.pathname]);

  // A new page (a link, the nav, a door on the couch) takes focus on #main so
  // screen readers land on it; Back leaves focus to the page it returns to,
  // and a page that put focus somewhere itself keeps it.
  useEffect(() => {
    if (navType !== 'PUSH') return;
    const main = document.getElementById('main');
    const active = document.activeElement;
    if (!main || (active !== main && main.contains(active))) return;
    main.focus({ preventScroll: true });
    // Page changes only: navType is read for the change that just happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <CameraProvider>
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

      {/* The room is the navigation on home: a corner menu instead of the bar. */}
      {location.pathname === '/' ? (
        <HomeMenuButton isLive={isLive} viewerCount={streamData?.viewer_count ?? null} statusReady={statusReady} />
      ) : (
        <Navigation isLive={isLive} viewerCount={streamData?.viewer_count ?? null} statusReady={statusReady} />
      )}

      <StaffLayer isLive={isLive} streamData={streamData} pathname={location.pathname} />

      <main
        id="main"
        tabIndex={-1}
        className={`transition-opacity duration-700 focus:outline-none ${isVisible ? 'opacity-100' : 'opacity-0'} ${signalLocking ? 'motion-safe:animate-signal-lock' : ''}`}
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
                channelData={channelData}
                isLive={isLive}
                streamData={streamData}
                loading={loading}
                clips={clips}
                videos={videos}
                statusReady={statusReady}
                introDone={!showTVIntro}
                introPullBack={intro.mode === 'gate'}
              />
            }
          />
          <Route path="/schedule" element={<SchedulePage isLive={isLive} stream={streamData} />} />
          <Route
            path="/vods"
            element={
              <VodsPage videos={videos} clips={clips} loading={loading} isLive={isLive} stream={streamData} statusReady={statusReady} />
            }
          />
          <Route path="/gear" element={<GearPage />} />
          <Route path="/gear-interactive" element={<GearInteractive />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/gamba" element={<GambaPage />}>
            <Route path="leaderboard" element={null} />
            <Route path="wheel" element={null} />
            <Route path="hunts" element={null} />
            <Route path="bonus-battle" element={null} />
            {/* Unknown tool ids still render GambaPage, which redirects them to the hub. */}
            <Route path="*" element={null} />
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
          <Route path="/store" element={<StorePage isLive={isLive} />} />
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
      </CameraProvider>
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
