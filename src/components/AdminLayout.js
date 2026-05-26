import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  MessageSquarePlus,
  Store,
  Inbox,
  Ticket,
  Gift,
  TrendingUp,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminLoginPage from '../pages/AdminLoginPage';

// Nav items annotated with `ownerOnly: true` are hidden from moderators.
const NAV_ITEMS = [
  { to: '/admin', label: 'Admin Hub', code: 'HUB', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Schedule', code: 'SCH', icon: Calendar },
  { to: '/admin/suggestions', label: 'Suggestions', code: 'SUG', icon: MessageSquarePlus },
  { to: '/admin/store', label: 'Store', code: 'STR', icon: Store, ownerOnly: true },
  { to: '/admin/redemptions', label: 'Redemptions', code: 'RED', icon: Inbox },
  { to: '/admin/tickets', label: 'Tickets', code: 'TKT', icon: Ticket },
  { to: '/admin/giveaways', label: 'Giveaways', code: 'GVW', icon: Gift },
  { to: '/admin/hunts', label: 'Hunts', code: 'HNT', icon: TrendingUp },
  { to: '/admin/users', label: 'Users', code: 'USR', icon: Users },
  { to: '/admin/moderators', label: 'Moderators', code: 'MOD', icon: ShieldCheck, ownerOnly: true },
];

export default function AdminLayout() {
  const { currentUser, role, isOwner, isStaff, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // Gate: must be owner OR moderator. AuthContext resolves role server-side
  // (owner via email match; moderator via admin_users/{uid} Firestore lookup).
  if (!currentUser || !isStaff) {
    return <AdminLoginPage onLoginSuccess={() => navigate('/admin')} signedIn={!!currentUser} />;
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex pt-16">
      {/* Sidebar — control panel register */}
      <aside
        className={`relative overflow-hidden flex flex-col bg-zinc-card/30 border-r border-white/8 transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Atmospheric backing — scoped to sidebar */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-orange-admin/10 blur-3xl motion-reduce:hidden"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />

        {/* Channel ID header */}
        <div
          className={`relative flex items-center gap-2 px-4 py-4 border-b border-white/8 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" aria-hidden="true" />
          {!collapsed && (
            <div className="flex flex-col leading-none gap-1">
              <span
                className="text-[9px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono"
      >
                Channel
              </span>
              <span
                className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono"
      >
                {role === 'owner' ? 'GG-ADMIN' : 'GG-MOD'}
              </span>
            </div>
          )}
        </div>

        {/* Nav — tabs, not chips */}
        <nav className="relative flex-1 py-3">
          {visibleNav.map(({ to, label, code, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 border-l-2 transition-colors duration-150 ${
                  isActive
                    ? 'bg-zinc-card border-orange-admin text-white-body'
                    : 'border-transparent text-white/55 hover:text-white-body hover:bg-zinc-card/40'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {!collapsed && (
                    <span
                      className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums ${
                        isActive ? 'text-orange-admin' : 'text-white/30'
                      }`}
                      
                    >
                      {code}
                    </span>
                  )}
                  <Icon size={16} className="flex-shrink-0 opacity-80" aria-hidden="true" />
                  {!collapsed && (
                    <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                      {label}
                    </span>
                  )}
                  {!collapsed && isActive && (
                    <span
                      className="ml-auto text-[9px] font-bold tracking-eyebrow-lg text-orange-admin font-mono"
      >
                      ON
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom — logout + collapse */}
        <div className="relative border-t border-white/8">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-red-destructive/75 hover:text-red-destructive hover:bg-red-destructive/5 transition-colors duration-150 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {!collapsed && (
              <span
                className="text-[10px] font-bold tracking-eyebrow-md text-red-destructive/60 font-mono"
      >
                OUT
              </span>
            )}
            <LogOut size={16} className="flex-shrink-0" aria-hidden="true" />
            {!collapsed && (
              <span className="text-sm font-bold tracking-tight">Logout</span>
            )}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-white/35 hover:text-white-body hover:bg-zinc-card/40 transition-colors duration-150 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={16} aria-hidden="true" />
            ) : (
              <>
                <span
                  className="text-[10px] font-bold tracking-eyebrow-md text-white/30 font-mono"
      >
                  HIDE
                </span>
                <ChevronLeft size={16} aria-hidden="true" />
                <span className="text-sm font-bold tracking-tight">Collapse</span>
              </>
            )}
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
