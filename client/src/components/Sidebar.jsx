import React from 'react';
import {
  LayoutDashboard,
  Table,
  Activity,
  GitCompare,
  Upload,
  Clock,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'explorer',     label: 'Table Explorer', icon: Table },
  { id: 'health',       label: 'Health Monitor', icon: Activity },
  { divider: true },
  { id: 'schemadiff',   label: 'Schema Diff',    icon: GitCompare },
  { id: 'csvimport',    label: 'CSV Import',      icon: Upload },
  { id: 'queryhistory', label: 'Query History',   icon: Clock },
];

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const { connectionConfig, isConnected } = useConnectionStore();

  return (
    <aside
      className={"flex flex-col h-screen bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 transition-all duration-200 " + (collapsed ? 'w-16' : 'w-56')}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Database className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-white leading-tight truncate">DataSphere</p>
            <p className="text-xs text-gray-400 truncate">Explorer</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          if (item.divider) {
            return collapsed
              ? <div key={i} className="my-2 border-t border-gray-100 dark:border-slate-700 mx-2" />
              : <p key={i} className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Pro Araçlar</p>;
          }
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={"w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors " + (
                active
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon className={"w-4 h-4 flex-shrink-0 " + (active ? 'text-blue-600 dark:text-blue-400' : '')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-700">
          <div className={"flex items-center gap-2 px-3 py-2 rounded-lg text-xs " + (
            isConnected
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
          )}>
            <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (isConnected ? 'bg-emerald-500' : 'bg-gray-400')} />
            <span className="truncate">{isConnected ? (connectionConfig?.host || 'Bağlı') : 'Bağlantı yok'}</span>
          </div>
        </div>
      )}

      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-center h-10 border-t border-gray-100 dark:border-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
};

export default Sidebar;
