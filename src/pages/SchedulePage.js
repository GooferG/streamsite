import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { SCHEDULE } from '../constants';
import { getGameCovers } from '../utils/igdbApi';

export default function SchedulePage() {
  const [gameCovers, setGameCovers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGameCovers = async () => {
      // Get all unique game names from schedule
      const gameNames = SCHEDULE.map((item) => item.gameName).filter(
        (name) => name !== null
      );

      if (gameNames.length > 0) {
        const covers = await getGameCovers(gameNames);
        setGameCovers(covers);
      }

      setLoading(false);
    };

    fetchGameCovers();
  }, []);

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              STREAM SCHEDULE
            </span>
          </h1>
          <p className="text-xl text-white/60 font-light">
            All times in MST (Arizona Time) • Schedule subject to change
          </p>
        </div>

        <div className="space-y-4">
          {SCHEDULE.map((item, index) => (
            <ScheduleItem
              key={item.day}
              item={item}
              delay={index * 50}
              coverUrl={item.gameName ? gameCovers[item.gameName] : null}
              loading={loading}
            />
          ))}
        </div>

        <div className="mt-16 p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <Calendar
              className="text-emerald-400 flex-shrink-0 mt-1"
              size={24}
            />
            <div>
              <h3 className="text-xl font-bold mb-2 text-emerald-400">
                Follow for Updates
              </h3>
              <p className="text-white/70 leading-relaxed">
                Schedule can change based on life events and special streams.
                Follow on Twitch and Twitter for real-time updates and
                notifications when going live!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleItem({ item, delay, coverUrl, loading }) {
  const statusStyles = {
    regular: 'border-emerald-500/20 hover:border-emerald-500/40',
    special: 'border-purple-500/40 hover:border-purple-500/60 bg-purple-900/10',
    off: 'border-white/10 hover:border-white/20 opacity-50',
  };

  return (
    <div
      className={`p-6 border rounded-xl backdrop-blur-sm transition-all duration-300 ${
        statusStyles[item.status]
      }`}
      style={{ animation: `slideUp 0.6s ease-out ${delay}ms backwards` }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Game Cover Image */}
        {coverUrl && (
          <div className="flex-shrink-0">
            <img
              src={coverUrl}
              alt={item.gameName || item.content}
              className="w-20 h-28 object-cover rounded-lg border-2 border-emerald-500/30"
            />
          </div>
        )}

        {/* Schedule Info */}
        <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="text-2xl font-black tracking-tighter text-emerald-400 w-32">
              {item.day}
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Clock size={18} />
              <span className="font-bold text-sm">{item.time}</span>
            </div>
          </div>
          <div className="text-lg font-bold flex-1">{item.content}</div>
          {item.status === 'special' && (
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-xs font-bold text-purple-400 w-fit">
              SPECIAL
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
