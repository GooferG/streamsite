import React, { useState, useEffect } from 'react';
import {
  Save,
  LogOut,
  Calendar,
  Clock,
  Gamepad2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SCHEDULE as DEFAULT_SCHEDULE } from '../constants';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
  'SUNDAY',
];

const STATUS_OPTIONS = ['on', 'off', 'special', 'regular'];

export default function AdminSchedulePage({ onLogout }) {
  const { logout } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Load schedule from Firebase
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const docRef = doc(db, 'settings', 'schedule');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSchedule(docSnap.data().schedule || DEFAULT_SCHEDULE);
        } else {
          // Initialize with default schedule from constants
          setSchedule(DEFAULT_SCHEDULE);
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
        setMessage({ type: 'error', text: 'Failed to load schedule' });
        // Use default schedule as fallback
        setSchedule(DEFAULT_SCHEDULE);
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, []);

  const handleFieldChange = (index, field, value) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, 'settings', 'schedule');
      await setDoc(docRef, { schedule, updatedAt: new Date().toISOString() });
      setMessage({ type: 'success', text: 'Schedule saved successfully!' });
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: 'Failed to save schedule' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="inline-block w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-6xl font-black tracking-tighter mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
                SCHEDULE EDITOR
              </span>
            </h1>
            <p className="text-white/60 text-lg">
              Update your stream schedule and it will reflect on the website
              immediately
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-100 font-bold hover:bg-red-500/30 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle
                size={20}
                className="text-emerald-400 flex-shrink-0"
              />
            ) : (
              <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                message.type === 'success' ? 'text-emerald-200' : 'text-red-200'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {schedule.map((day, index) => (
            <div
              key={day.day}
              className="p-6 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={20} className="text-emerald-400" />
                <h2 className="text-2xl font-black tracking-tight">
                  {day.day}
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    <Clock size={14} className="inline mr-1" />
                    Time
                  </label>
                  <input
                    type="text"
                    value={day.time}
                    onChange={(e) =>
                      handleFieldChange(index, 'time', e.target.value)
                    }
                    placeholder="7:00 PM EST"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Status
                  </label>
                  <select
                    value={day.status}
                    onChange={(e) =>
                      handleFieldChange(index, 'status', e.target.value)
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Content Description
                  </label>
                  <input
                    type="text"
                    value={day.content}
                    onChange={(e) =>
                      handleFieldChange(index, 'content', e.target.value)
                    }
                    placeholder="Gaming, Gambling, Just Chatting"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    <Gamepad2 size={14} className="inline mr-1" />
                    Game Name (optional)
                  </label>
                  <input
                    type="text"
                    value={day.gameName || ''}
                    onChange={(e) =>
                      handleFieldChange(index, 'gameName', e.target.value)
                    }
                    placeholder="Fortnite, Valorant, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </div>
  );
}
