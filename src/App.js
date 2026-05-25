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
import TwitchCallbackPage from './pages/TwitchCallbackPage';
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
  const [showTVIntro, setShowTVIntro] = useState(true);

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
    const timer = setTimeout(() => {
      setShowTVIntro(false);
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const productPrefixes = ['/gamba', '/admin', '/twitch-callback', '/suggest-overlay'];
    const isProduct = productPrefixes.some((p) => location.pathname.startsWith(p));
    document.body.classList.toggle('brand-route', !isProduct);
    return () => document.body.classList.remove('brand-route');
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-zinc-broadcast text-white-body">
      {showTVIntro && <TVStaticIntro />}

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
              element={<Navigate to="/gamba/hunt-tracker" replace />}
            />
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
          </Route>
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/twitch-callback" element={<TwitchCallbackPage />} />
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
