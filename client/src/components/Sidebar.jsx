import React from 'react';
import {
  LayoutDashboard,
  Table,
  Activity,
  Upload,
  Clock,
  ChevronLeft,
  ChevronRight,
  Database,
  Sparkles,
  LogOut,
  Code2,
} from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'explorer',     label: 'Data Explorer',  icon: Table },
  { id: 'health',       label: 'Health Monitor', icon: Activity },
  { id: 'smartquery',   label: 'Smart Query',    icon: Sparkles },
  { id: 'sqleditor',    label: 'SQL Editor',     icon: Code2 },
  { divider: true },
  { id: 'csvimport',    label: 'CSV Import',     icon: Upload },
  { id: 'queryhistory', label: 'Query History',  icon: Clock },
];

const Sidebar = ({ activeTab, setActiveTab, onDisconnect }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const { connectionConfig, isConnected } = useConnectionStore();

  return (
    <aside
      className={
        "flex flex-col h-screen sidebar-glass transition-all duration-300 ease-out flex-shrink-0 relative z-10 " +
        (collapsed ? 'w-[68px]' : 'w-60')
      }
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
          <Database className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
              DataSphere
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium tracking-wide uppercase">
              Explorer
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          if (item.divider) {
            return collapsed
              ? <div key={i} className="my-3 border-t border-gray-200/60 dark:border-white/5 mx-2" />
              : (
                <p key={i} className="px-3 pt-5 pb-2 text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-[0.12em]">
                  Pro Araclar
                </p>
              );
          }
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group " +
                (active
                  ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-800 dark:hover:text-white')
              }
            >
              <Icon
                className={
                  "w-[18px] h-[18px] flex-shrink-0 transition-colors " +
                  (active ? 'text-brand-500 dark:text-brand-400' : 'group-hover:text-gray-600 dark:group-hover:text-slate-300')
                }
                strokeWidth={active ? 2.2 : 1.8}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto">
        {/* Connection badge */}
        {!collapsed && isConnected && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-emerald-50/80 dark:bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/10">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="truncate">{connectionConfig?.host || 'Bagli'}</span>
            </div>
          </div>
        )}

        {/* Theme + Disconnect */}
        <div className={"flex items-center px-3 py-2 gap-1 border-t border-gray-200/50 dark:border-white/5 " + (collapsed ? 'flex-col' : 'flex-row')}>
          <ThemeToggle />
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              title="Baglantiyi Kes"
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center h-10 border-t border-gray-200/50 dark:border-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all duration-150"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
