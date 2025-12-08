import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import GrainOverlay from './components/GrainOverlay';
import TVStaticIntro from './components/TVStaticIntro';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import VodsPage from './pages/VodsPage';
import AboutPage from './pages/AboutPage';
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

export default function StreamingSite() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isVisible, setIsVisible] = useState(false);
  const [channelData, setChannelData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [clips, setClips] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTVIntro, setShowTVIntro] = useState(true);

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

  const pages = {
    home: (
      <HomePage
        setPage={setCurrentPage}
        channelData={channelData}
        isLive={isLive}
        streamData={streamData}
        loading={loading}
        clips={clips}
      />
    ),
    schedule: <SchedulePage />,
    vods: <VodsPage videos={videos} clips={clips} loading={loading} />,
    about: <AboutPage />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950 to-purple-950 text-white">
      {showTVIntro && <TVStaticIntro />}

      <GrainOverlay />

      <Navigation currentPage={currentPage} setPage={setCurrentPage} />

      <main
        className={`transition-opacity duration-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {pages[currentPage]}
      </main>

      <style jsx>{`
        @keyframes grain {
          0%,
          100% {
            transform: translate(0, 0);
          }
          10% {
            transform: translate(-5%, -10%);
          }
          20% {
            transform: translate(-15%, 5%);
          }
          30% {
            transform: translate(7%, -25%);
          }
          40% {
            transform: translate(-5%, 25%);
          }
          50% {
            transform: translate(-15%, 10%);
          }
          60% {
            transform: translate(15%, 0%);
          }
          70% {
            transform: translate(0%, 15%);
          }
          80% {
            transform: translate(3%, 35%);
          }
          90% {
            transform: translate(-10%, 10%);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes glow {
          0%,
          100% {
            opacity: 0.5;
            filter: blur(20px);
          }
          50% {
            opacity: 0.8;
            filter: blur(30px);
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
