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
        "flex flex-col h-screen bg-black/30 backdrop-blur-2xl border-r border-white/[0.06] transition-all duration-300 ease-out flex-shrink-0 relative z-10 " +
        (collapsed ? 'w-[68px]' : 'w-60')
      }
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
          <Database className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight tracking-tight">
              DataSphere
            </p>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">
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
              ? <div key={i} className="my-3 border-t border-white/[0.05] mx-2" />
              : (
                <p key={i} className="px-3 pt-5 pb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.12em]">
                  Pro Tools
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
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.08)]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent')
              }
            >
              <Icon
                className={
                  "w-[18px] h-[18px] flex-shrink-0 transition-colors " +
                  (active ? 'text-blue-400' : 'group-hover:text-slate-300')
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
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-emerald-500/[0.08] text-emerald-400 border border-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.06)]">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              </span>
              <span className="truncate">{connectionConfig?.host || 'Connected'}</span>
            </div>
          </div>
        )}

        {/* Disconnect */}
        <div className={"flex items-center px-3 py-2 gap-1 border-t border-white/[0.05] " + (collapsed ? 'flex-col' : 'flex-row justify-end')}>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              title="Disconnect"
              className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center h-10 border-t border-white/[0.05] text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] transition-all duration-150"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
