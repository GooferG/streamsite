import { useState, useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import Navigation from './components/Navigation';
import GrainOverlay from './components/GrainOverlay';
import TVStaticIntro from './components/TVStaticIntro';
import LiveIndicator from './components/LiveIndicator';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import VodsPage from './pages/VodsPage';
import AboutPage from './pages/AboutPage';
import GambaPage from './pages/GambaPage';
import GamingPage from './pages/GamingPage';
import GearPage from './pages/Gear';
import GearInteractive from './pages/GearInteractive';
import AdminLayout from './components/AdminLayout';
import AdminHubPage from './pages/AdminHubPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminSuggestionsPage from './pages/AdminSuggestionsPage';
import AdminStorePage from './pages/AdminStorePage';
import AdminRedemptionsPage from './pages/AdminRedemptionsPage';
import AdminTicketsPage from './pages/AdminTicketsPage';
import AdminGiveawaysPage from './pages/AdminGiveawaysPage';
import AdminHuntsPage from './pages/AdminHuntsPage';
import AdminCommunityHuntsPage from './pages/AdminCommunityHuntsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminModeratorsPage from './pages/AdminModeratorsPage';
import StorePage from './pages/StorePage';
import GiveawayPage from './pages/GiveawayPage';
import MyAccountPage from './pages/MyAccountPage';
import TwitchCallbackPage from './pages/TwitchCallbackPage';
import DiscordCallbackPage from './pages/DiscordCallbackPage';
import SuggestPage from './pages/SuggestPage';
import SuggestOverlay from './pages/SuggestOverlay';
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
      {showTVIntro && <TVStaticIntro onComplete={handleIntroComplete} />}

      <GrainOverlay />

      <Navigation
        currentPage={currentPage}
        setPage={(id) => navigate(id === 'home' ? '/' : `/${id}`)}
      />

      <LiveIndicator isLive={isLive} streamData={streamData} />

      <main
        className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
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
        </Routes>
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
