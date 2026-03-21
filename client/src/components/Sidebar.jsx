import React from 'react';
import { Database, Folder, LayoutDashboard, Sparkles, LogOut, Activity, GitFork } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import ThemeToggle from './ThemeToggle';

const Sidebar = ({ onDisconnect, activeTab, setActiveTab }) => {
  const { isConnected, connectionConfig } = useConnectionStore();

  const navItem = (tab, Icon, label, accent = null) => {
    const active = activeTab === tab;
    return (
      <div
        key={tab}
        onClick={() => isConnected && setActiveTab(tab)}
        className={`flex items-center px-4 py-2.5 cursor-pointer transition-all duration-150 border-l-4 select-none ${
          active
            ? 'bg-slate-800 text-white border-blue-500'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white border-transparent'
        } ${!isConnected ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${accent && !active ? accent : ''}`} />
        <span className="text-sm">{label}</span>
      </div>
    );
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen border-r border-slate-800 shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
        <Database className="w-6 h-6 text-blue-400 flex-shrink-0" />
        <span className="font-bold text-lg leading-none">DataSphere</span>
      </div>

      <div className="px-4 py-3 border-b border-slate-800">
        {isConnected ? (
          <>
            <div className="flex items-center space-x-2 text-green-400 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-medium">Bağlı</span>
            </div>
            <p className="text-xs text-slate-300 truncate" title={connectionConfig?.host}>
              {connectionConfig?.host}
            </p>
            <p className="text-xs text-slate-500">{connectionConfig?.user}</p>
          </>
        ) : (
          <p className="text-xs text-slate-500">Bağlantı yok</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <p className="px-4 mb-2 text-xs text-slate-500 uppercase font-semibold tracking-wider">Genel</p>
        <nav className="space-y-0.5">
          {navItem('dashboard', LayoutDashboard, 'Dashboard')}
          {navItem('explorer',  Folder,          'Explorer')}
        </nav>

        <p className="px-4 mt-5 mb-2 text-xs text-slate-500 uppercase font-semibold tracking-wider">Analiz</p>
        <nav className="space-y-0.5">
          {navItem('health',  Activity, 'Health Monitor', 'text-emerald-400')}
          {navItem('lineage', GitFork,  'Data Lineage',   'text-purple-400')}
        </nav>

        <p className="px-4 mt-5 mb-2 text-xs text-slate-500 uppercase font-semibold tracking-wider">AI</p>
        <nav className="space-y-0.5">
          {navItem('ai', Sparkles, 'AI Assistant', 'text-purple-400')}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <ThemeToggle />
          {isConnected && (
            <button
              onClick={onDisconnect}
              className="flex items-center text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Bağlantıyı Kes
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 text-center font-medium pt-2 border-t border-slate-800/50">
          Created by <span className="text-slate-400">Oktay Doğanyıldız</span>
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
