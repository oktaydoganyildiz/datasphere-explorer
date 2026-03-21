import React from 'react';
import { Database, Folder, Table, Sheet, LogOut, LayoutDashboard, Sparkles } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import ThemeToggle from './ThemeToggle';

const Sidebar = ({ onDisconnect, activeTab, setActiveTab }) => {
  const { isConnected, connectionConfig } = useConnectionStore();

  const navItemClass = (tabName) => `
    flex items-center px-4 py-2 cursor-pointer transition-colors
    ${activeTab === tabName 
      ? 'bg-slate-800 text-white border-l-4 border-blue-500' 
      : 'text-slate-400 hover:bg-slate-800 hover:text-white border-l-4 border-transparent'}
  `;

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen border-r border-slate-800 shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
        <Database className="w-6 h-6 text-blue-400" />
        <span className="font-bold text-lg">DataSphere</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {isConnected ? (
          <div className="px-4 mb-6">
            <div className="flex items-center space-x-2 text-green-400 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm font-medium">Connected</span>
            </div>
            <div className="text-sm text-slate-300 truncate" title={connectionConfig?.host}>
              {connectionConfig?.host}
            </div>
            <div className="text-xs text-slate-500">{connectionConfig?.user}</div>
          </div>
        ) : (
          <div className="px-4 mb-6 text-sm text-slate-500">Not connected</div>
        )}

        <div className="px-4 mb-2 text-xs text-slate-400 uppercase font-semibold">Menu</div>
        
        <nav className="space-y-1">
          <div onClick={() => isConnected && setActiveTab('dashboard')} className={navItemClass('dashboard')}>
            <LayoutDashboard className="w-4 h-4 mr-3" />
            Dashboard
          </div>
          
          <div onClick={() => isConnected && setActiveTab('explorer')} className={navItemClass('explorer')}>
            <Folder className="w-4 h-4 mr-3" />
            Explorer
          </div>

          <div onClick={() => isConnected && setActiveTab('ai')} className={navItemClass('ai')}>
             <Sparkles className="w-4 h-4 mr-3 text-purple-400" />
             AI Assistant
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
         <div className="flex items-center justify-between mb-4">
            <ThemeToggle />
            {isConnected && (
                <button 
                  onClick={onDisconnect}
                  className="flex items-center text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Disconnect
                </button>
            )}
         </div>
         
         <div className="text-[10px] text-slate-500 text-center font-medium pt-2 border-t border-slate-800/50">
            Created by <span className="text-slate-400">Oktay Doğanyıldız</span>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;
