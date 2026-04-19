# Admin Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `/admin` page with a collapsible sidebar layout featuring a Hub dashboard, Schedule page, and Suggestions management page with drag-and-drop reordering and full edit capability.

**Architecture:** New nested routes under `/admin/*` with `AdminLayout.js` as the shell (collapsible sidebar + auth gate). `AdminHubPage` is the landing page with feature cards. `AdminSchedulePage` and `AdminSuggestionsPage` are extracted/enhanced from existing admin code. The Suggestions tab in GambaPage remains untouched (visitor-facing).

**Tech Stack:** React, React Router v6 nested routes, Firebase Firestore, @dnd-kit/core + @dnd-kit/sortable for drag-and-drop, Tailwind CSS, lucide-react icons.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/AdminLayout.js` | Create | Sidebar shell, auth gate, collapse state |
| `src/pages/AdminHubPage.js` | Create | Dashboard with feature cards |
| `src/pages/AdminSchedulePage.js` | Rename/refactor | Schedule editor (extracted from current standalone page) |
| `src/pages/AdminSuggestionsPage.js` | Create | Suggestions list with DnD reorder + edit modal |
| `src/App.js` | Modify | Replace `/admin` route with nested `/admin/*` routes |
| `src/components/SuggestAdminTab.js` | Keep | Still used in GambaPage visitor tools |

Note: The old `src/pages/AdminSchedulePage.js` currently exists as a standalone page. We will replace its content with a version that works inside the layout (no own header/logout button — those move to the sidebar).

---

## Task 1: Install @dnd-kit

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install dnd-kit packages**

Run from the project root (`c:/Users/luizm/Desktop/Software_Engineer/StreamingSite/goofer-live`):
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Expected: packages added to `node_modules` and `package.json` dependencies, no errors.

- [ ] **Step 2: Verify install**

Run:
```bash
node -e "require('@dnd-kit/core'); console.log('ok')"
```
Expected: prints `ok`.

---

## Task 2: Create AdminLayout component

**Files:**
- Create: `src/components/AdminLayout.js`

- [ ] **Step 1: Create the file**

Create `src/components/AdminLayout.js` with the following content:

```jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquarePlus, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminLoginPage from '../pages/AdminLoginPage';

const NAV_ITEMS = [
  { to: '/admin', label: 'Admin Hub', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Schedule', icon: Calendar },
  { to: '/admin/suggestions', label: 'Suggestions', icon: MessageSquarePlus },
];

export default function AdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  if (!currentUser) {
    return <AdminLoginPage onLoginSuccess={() => navigate('/admin')} />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex pt-16">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-zinc-950/80 border-r border-white/10 backdrop-blur-sm transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo area */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed && (
            <span className="text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400 uppercase">
              Admin
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border border-emerald-500/30 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: logout + collapse toggle */}
        <div className="pb-4 px-2 space-y-1 border-t border-white/10 pt-4">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/10 font-bold text-sm transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 font-bold text-sm transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors**

Run:
```bash
cd "c:/Users/luizm/Desktop/Software_Engineer/StreamingSite/goofer-live" && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/components/AdminLayout.js', 'utf8');
console.log('Lines:', src.split('\n').length, '— file exists');
"
```
Expected: prints line count, no errors.

---

## Task 3: Create AdminHubPage

**Files:**
- Create: `src/pages/AdminHubPage.js`

- [ ] **Step 1: Create the file**

Create `src/pages/AdminHubPage.js`:

```jsx
import { useNavigate } from 'react-router-dom';
import { Calendar, MessageSquarePlus, LayoutDashboard } from 'lucide-react';

const HUB_CARDS = [
  {
    to: '/admin/schedule',
    icon: Calendar,
    title: 'Schedule',
    description: 'Edit your stream schedule. Changes reflect on the public schedule page immediately.',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    to: '/admin/suggestions',
    icon: MessageSquarePlus,
    title: 'Suggestions',
    description: 'Manage viewer game suggestions. Highlight picks, edit entries, reorder, or clear the list.',
    color: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
    iconColor: 'text-purple-400',
  },
];

export default function AdminHubPage() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-2 text-white/40 font-bold text-sm mb-3">
          <LayoutDashboard size={16} />
          ADMIN HUB
        </div>
        <h1 className="text-5xl font-black tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            What are we managing?
          </span>
        </h1>
        <p className="text-white/50 mt-3 text-lg">Pick a section to get started.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {HUB_CARDS.map(({ to, icon: Icon, title, description, color, border, iconColor }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`text-left p-8 rounded-2xl bg-gradient-to-br ${color} border ${border} hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 space-y-4`}
          >
            <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${iconColor}`}>
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
              <p className="text-white/60 mt-1 text-sm leading-relaxed">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run:
```bash
node -e "require('fs').accessSync('src/pages/AdminHubPage.js'); console.log('ok')"
```
Expected: prints `ok`.

---

## Task 4: Refactor AdminSchedulePage to work inside AdminLayout

The existing `AdminSchedulePage.js` has its own header, logout button, and full-page padding designed for standalone use. We need to remove the logout button and header chrome (those now live in the sidebar) and adjust padding.

**Files:**
- Modify: `src/pages/AdminSchedulePage.js`

- [ ] **Step 1: Replace file content**

Replace the entire content of `src/pages/AdminSchedulePage.js` with:

```jsx
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
```

- [ ] **Step 2: Verify the old `onLogout` prop is gone**

Run:
```bash
grep -n "onLogout" src/pages/AdminSchedulePage.js
```
Expected: no output (prop removed).

---

## Task 5: Create AdminSuggestionsPage with DnD + edit modal

**Files:**
- Create: `src/pages/AdminSuggestionsPage.js`

- [ ] **Step 1: Create the file**

Create `src/pages/AdminSuggestionsPage.js`:

```jsx
import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, doc, writeBatch, setDoc
} from 'firebase/firestore';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Star, X, RefreshCcw, MessageSquarePlus, GripVertical, Pencil, ExternalLink
} from 'lucide-react';
import { db } from '../config/firebase';

function SortableRow({ suggestion, onHighlight, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: suggestion.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
        suggestion.status === 'highlighted'
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical size={18} />
      </button>

      {suggestion.profileImageUrl && (
        <img
          src={suggestion.profileImageUrl}
          alt=""
          className="w-9 h-9 rounded-full border border-white/20 flex-shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-white">{suggestion.gameName}</p>
          {suggestion.status === 'highlighted' && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
              PICKED
            </span>
          )}
        </div>
        <p className="text-sm text-white/50">
          {suggestion.twitchName}
          {suggestion.rainbetName
            ? <span className="text-emerald-400/70"> · {suggestion.rainbetName}</span>
            : null}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onHighlight(suggestion)}
          className={`p-2 rounded-lg border transition-all ${
            suggestion.status === 'highlighted'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-emerald-300 hover:border-emerald-400/60'
          }`}
          title="Toggle highlight"
        >
          <Star size={16} />
        </button>
        <button
          onClick={() => onEdit(suggestion)}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-purple-400/60 transition-all"
          title="Edit suggestion"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(suggestion.id)}
          className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
          title="Delete suggestion"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function EditModal({ suggestion, onClose, onSave }) {
  const [gameName, setGameName] = useState(suggestion.gameName || '');
  const [rainbetName, setRainbetName] = useState(suggestion.rainbetName || '');
  const [twitchName, setTwitchName] = useState(suggestion.twitchName || '');
  const [status, setStatus] = useState(suggestion.status || 'pending');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!gameName.trim()) return;
    setSaving(true);
    await onSave(suggestion.id, {
      gameName: gameName.trim(),
      rainbetName: rainbetName.trim() || null,
      twitchName: twitchName.trim(),
      status,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Edit Suggestion</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-white/60 mb-1">Game / Slot Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Twitch Name</label>
            <input
              type="text"
              value={twitchName}
              onChange={(e) => setTwitchName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Rainbet Username</label>
            <input
              type="text"
              value={rainbetName}
              onChange={(e) => setRainbetName(e.target.value)}
              placeholder="optional"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 focus:border-emerald-400 focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="highlighted">Highlighted (Picked)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !gameName.trim()}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold hover:from-emerald-600 hover:to-purple-600 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSuggestions((items) => {
      const oldIndex = items.findIndex((s) => s.id === active.id);
      const newIndex = items.findIndex((s) => s.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const toggleHighlight = async (suggestion) => {
    await updateDoc(doc(db, 'suggestions', suggestion.id), {
      status: suggestion.status === 'highlighted' ? 'pending' : 'highlighted',
    });
  };

  const removeSuggestion = async (id) => {
    await deleteDoc(doc(db, 'suggestions', id));
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    suggestions.forEach((s) => batch.delete(doc(db, 'suggestions', s.id)));
    await batch.commit();
    setClearConfirm(false);
  };

  const saveEdit = async (id, fields) => {
    await updateDoc(doc(db, 'suggestions', id), fields);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
          <MessageSquarePlus size={16} />
          SUGGESTIONS
        </div>
        <h1 className="text-4xl font-black tracking-tighter">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
            Viewer Suggestions
          </span>
        </h1>
        <p className="text-white/50 mt-1">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} — drag to reorder, star to highlight as picked.
        </p>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <a
          href="/suggest"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-400/60 text-sm font-bold transition-all"
        >
          <ExternalLink size={14} />
          goofer.tv/suggest
        </a>

        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={suggestions.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-red-400/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={14} />
            CLEAR ALL
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all"
            >
              Confirm Clear
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          No suggestions yet. Share <strong className="text-white/60">goofer.tv/suggest</strong> with chat!
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={suggestions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {suggestions.map((s) => (
                <SortableRow
                  key={s.id}
                  suggestion={s}
                  onHighlight={toggleHighlight}
                  onEdit={setEditTarget}
                  onDelete={removeSuggestion}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editTarget && (
        <EditModal
          suggestion={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify file exists and has no obvious issues**

Run:
```bash
grep -c "SortableRow\|EditModal\|AdminSuggestionsPage" src/pages/AdminSuggestionsPage.js
```
Expected: `3` (all three function names present).

---

## Task 6: Update App.js routing

**Files:**
- Modify: `src/App.js`

- [ ] **Step 1: Add new imports**

In `src/App.js`, replace the existing admin-related imports:

Find:
```js
import AdminLoginPage from './pages/AdminLoginPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
```

Replace with:
```js
import AdminLoginPage from './pages/AdminLoginPage';
import AdminLayout from './components/AdminLayout';
import AdminHubPage from './pages/AdminHubPage';
import AdminSchedulePage from './pages/AdminSchedulePage';
import AdminSuggestionsPage from './pages/AdminSuggestionsPage';
```

- [ ] **Step 2: Replace the `/admin` route with nested routes**

In `src/App.js`, find:
```jsx
          <Route path="/admin" element={
            currentUser
              ? <AdminSchedulePage onLogout={() => navigate('/')} />
              : <AdminLoginPage onLoginSuccess={() => navigate('/admin')} />
          } />
```

Replace with:
```jsx
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHubPage />} />
            <Route path="schedule" element={<AdminSchedulePage />} />
            <Route path="suggestions" element={<AdminSuggestionsPage />} />
          </Route>
```

- [ ] **Step 3: Verify routing looks correct**

Run:
```bash
grep -A 6 'path="/admin"' src/App.js
```
Expected: shows `AdminLayout` as the element, with child routes for `index`, `schedule`, and `suggestions`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminLayout.js src/pages/AdminHubPage.js src/pages/AdminSchedulePage.js src/pages/AdminSuggestionsPage.js src/App.js
git commit -m "feat: admin sidebar layout with hub, schedule, and suggestions pages"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start dev server**

Run:
```bash
vercel dev
```
Then open `http://localhost:3000/admin` in a browser.

- [ ] **Step 2: Verify auth gate**

While logged out, `/admin` should show the login page. Log in with `luimeneghim@gmail.com`.

- [ ] **Step 3: Verify hub page**

After login, should see the Admin Hub with Schedule and Suggestions cards. Clicking each card navigates to the correct page.

- [ ] **Step 4: Verify sidebar**

Sidebar shows Hub, Schedule, Suggestions links. Active link is highlighted. Collapse button hides labels. Expand restores them. Logout signs out and redirects to `/`.

- [ ] **Step 5: Verify Schedule page**

`/admin/schedule` shows the schedule editor. Editing a day and saving shows success message. No duplicate logout button.

- [ ] **Step 6: Verify Suggestions page**

`/admin/suggestions` shows all Firestore suggestions. Drag handle reorders rows locally. Star toggles highlighted status in Firestore. Pencil opens edit modal — all fields (game name, Twitch name, Rainbet name, status) editable and saved to Firestore. X deletes. Clear All with confirm wipes the list.

- [ ] **Step 7: Verify GambaPage unchanged**

Navigate to `/gamba`. Suggestions tab still visible to logged-in admin. Visitor-facing suggestions list unchanged.

- [ ] **Step 8: Verify `/suggest` overlay unchanged**

`/suggest` and `/suggest-overlay` work as before.
