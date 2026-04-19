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
