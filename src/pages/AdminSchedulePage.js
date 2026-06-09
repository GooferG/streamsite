import React, { useState, useEffect } from 'react';
import {
  Save,
  Clock,
  Gamepad2,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
} from 'lucide-react';
import GameAutocomplete from '../components/GameAutocomplete';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SCHEDULE as DEFAULT_SCHEDULE } from '../constants';
import { orderByWeek, dayDisplay } from '../utils/scheduleWeek';

const STATUS_OPTIONS = ['on', 'off', 'special', 'regular'];

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

const STATUS_ACCENT = {
  regular: { dot: 'bg-emerald-signal', text: 'text-emerald-signal', label: 'REGULAR' },
  on: { dot: 'bg-emerald-signal', text: 'text-emerald-signal', label: 'ON' },
  special: { dot: 'bg-purple-gamba', text: 'text-purple-bright', label: 'SPECIAL' },
  off: { dot: 'bg-white/30', text: 'text-white/45', label: 'DARK' },
};

function FieldLabel({ icon: Icon, children, code }) {
  return (
    <span
      className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/50 mb-1.5 font-mono"
      >
      {code && (
        <span className="text-orange-admin tabular-nums">{code}</span>
      )}
      {Icon && <Icon size={11} aria-hidden="true" className="opacity-80" />}
      <span>{children}</span>
    </span>
  );
}

function DayFields({ day, onField }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <label className="block">
        <FieldLabel icon={Clock} code="01">
          Time
        </FieldLabel>
        <input
          type="text"
          value={day.time}
          onChange={(e) => onField('time', e.target.value)}
          placeholder="7:00 PM EST"
          className={inputCls}
        />
      </label>
      <label className="block">
        <FieldLabel code="02">Status</FieldLabel>
        <select
          value={day.status}
          onChange={(e) => onField('status', e.target.value)}
          className={inputCls}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <FieldLabel code="03">Content description</FieldLabel>
        <input
          type="text"
          value={day.content}
          onChange={(e) => onField('content', e.target.value)}
          placeholder="Gaming, Gambling, Just Chatting"
          className={inputCls}
        />
      </label>
      <label className="block">
        <FieldLabel icon={Gamepad2} code="04">
          Game name · optional
        </FieldLabel>
        <GameAutocomplete
          value={day.gameName || ''}
          onChange={(val) => onField('gameName', val)}
          placeholder="Fortnite, Valorant…"
          className={inputCls}
        />
      </label>
    </div>
  );
}

function DayPanel({ day, index, onChange }) {
  const accent = STATUS_ACCENT[day.status] || STATUS_ACCENT.regular;
  const dayCode = String(index + 1).padStart(2, '0');

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Day header strip */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono"
      >
        <span className={`inline-flex items-center gap-2 ${accent.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          <span>{accent.label}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/45">DAY</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {dayCode}
        </span>
        <span className="ml-auto text-white-body text-sm font-bold tracking-tight tabular-nums">
          {day.day}
        </span>
      </div>

      {/* Fields */}
      <div className="px-4 py-4">
        <DayFields
          day={day}
          onField={(field, value) => onChange(index, field, value)}
        />
      </div>
    </div>
  );
}

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
        setSchedule(
          docSnap.exists()
            ? docSnap.data().schedule || DEFAULT_SCHEDULE
            : DEFAULT_SCHEDULE
        );
      } catch (error) {
        console.error('Error loading schedule:', error);
        setMessage({ type: 'error', text: 'Failed to load schedule.' });
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
      await setDoc(doc(db, 'settings', 'schedule'), {
        schedule,
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'success', text: 'Schedule saved.' });
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: 'Failed to save schedule.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="border border-white/8 bg-zinc-card/30 py-16 flex flex-col items-center gap-3">
          <RefreshCcw
            size={20}
            className="text-white/40 animate-spin"
            aria-hidden="true"
          />
          <p
            className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
            Loading schedule…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Slate header */}
      <header className="mb-8">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono"
      >
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>PROGRAMMING DESK</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">SCH</span>
          <span className="text-white/20">·</span>
          <span className="text-white/30 tabular-nums">
            {String(schedule.length).padStart(2, '0')} DAYS
          </span>
        </div>

        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">Stream</span>
          <span className="block text-orange-admin">schedule.</span>
        </h1>

        <p className="mt-4 text-sm text-white/55 max-w-md leading-relaxed">
          Changes go live on the public schedule page immediately on save.
        </p>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 flex items-center gap-3 px-4 py-3 border ${
            message.type === 'success'
              ? 'border-emerald-signal/40 bg-emerald-signal/5'
              : 'border-red-destructive/40 bg-red-destructive/5'
          }`}
          role="status"
        >
          {message.type === 'success' ? (
            <CheckCircle
              size={16}
              className="text-emerald-signal flex-shrink-0"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              size={16}
              className="text-red-destructive flex-shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <div
              className={`text-[0.625rem] font-bold tracking-eyebrow-md uppercase mb-0.5 ${
                message.type === 'success'
                  ? 'text-emerald-signal'
                  : 'text-red-destructive/80'
              }`}
              
            >
              {message.type === 'success' ? 'Saved' : 'Save failed'}
            </div>
            <p className="text-sm text-white/80">{message.text}</p>
          </div>
        </div>
      )}

      {/* Day panels */}
      <div className="space-y-4 mb-8">
        {schedule.map((day, index) => (
          <DayPanel
            key={day.day}
            day={day}
            index={index}
            onChange={handleFieldChange}
          />
        ))}
      </div>

      {/* Save bar */}
      <div className="border border-white/8 bg-zinc-card/30">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono"
      >
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>Commit changes</span>
          </span>
        </div>
        <div className="px-4 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} aria-hidden="true" />
            <span
              className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
              {saving ? 'Saving…' : 'Save schedule'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
