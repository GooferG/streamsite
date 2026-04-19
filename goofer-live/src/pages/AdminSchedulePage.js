import React, { useState, useEffect } from 'react';
import { Save, Calendar, Clock, Gamepad2, AlertCircle, CheckCircle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SCHEDULE as DEFAULT_SCHEDULE } from '../constants';

const STATUS_OPTIONS = ['on', 'off', 'special', 'regular'];

export default function AdminSchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const docRef = doc(db, 'settings', 'schedule');
        const docSnap = await getDoc(docRef);
        setSchedule(docSnap.exists() ? (docSnap.data().schedule || DEFAULT_SCHEDULE) : DEFAULT_SCHEDULE);
      } catch (error) {
        console.error('Error loading schedule:', error);
        setMessage({ type: 'error', text: 'Failed to load schedule' });
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
      await setDoc(doc(db, 'settings', 'schedule'), { schedule, updatedAt: new Date().toISOString() });
      setMessage({ type: 'success', text: 'Schedule saved successfully!' });
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: 'Failed to save schedule' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
          <Calendar size={16} />
          SCHEDULE
        </div>
        <h1 className="text-4xl font-black tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            Stream Schedule
          </span>
        </h1>
        <p className="text-white/50 mt-1">Changes reflect on the public schedule page immediately.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          {message.type === 'success'
            ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
            : <AlertCircle size={18} className="text-red-400 flex-shrink-0" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-200' : 'text-red-200'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-4 mb-8">
        {schedule.map((day, index) => (
          <div key={day.day} className="p-6 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-emerald-400" />
              <h2 className="text-xl font-black tracking-tight">{day.day}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  <Clock size={13} className="inline mr-1" />Time
                </label>
                <input
                  type="text"
                  value={day.time}
                  onChange={(e) => handleFieldChange(index, 'time', e.target.value)}
                  placeholder="7:00 PM EST"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Status</label>
                <select
                  value={day.status}
                  onChange={(e) => handleFieldChange(index, 'status', e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Content Description</label>
                <input
                  type="text"
                  value={day.content}
                  onChange={(e) => handleFieldChange(index, 'content', e.target.value)}
                  placeholder="Gaming, Gambling, Just Chatting"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  <Gamepad2 size={13} className="inline mr-1" />Game Name (optional)
                </label>
                <input
                  type="text"
                  value={day.gameName || ''}
                  onChange={(e) => handleFieldChange(index, 'gameName', e.target.value)}
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
  );
}
