import React, { useState } from 'react';
import useConnectionStore from './store/connectionStore';
import Sidebar from './components/Sidebar';
import ConnectionForm from './components/ConnectionForm';
import TableList from './components/TableList';
import PreviewModal from './components/PreviewModal';
import Dashboard from './components/Dashboard';
import AiQueryBuilder from './components/AiQueryBuilder';

function App() {
  const { isConnected, reset } = useConnectionStore();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'explorer' | 'ai'
  const [previewTarget, setPreviewTarget] = useState(null);

  const handleDisconnect = async () => {
    try {
      await fetch('/api/connection/disconnect', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      reset();
      setActiveTab('dashboard');
    }
  };

  const handlePreview = (schema, table) => {
    setPreviewTarget({ schema, table });
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      <Sidebar 
        onDisconnect={handleDisconnect} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <main className="flex-1 overflow-auto p-6 relative">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {isConnected ? (
                activeTab === 'dashboard' ? 'System Dashboard' : 
                activeTab === 'ai' ? 'AI Assistant' : 'Data Explorer'
              ) : 'Welcome to DataSphere Explorer'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {isConnected 
                ? 'Manage and analyze your SAP HANA data.' 
                : 'Connect to your SAP HANA Cloud or DataSphere instance to get started.'}
            </p>
          </div>
        </header>

        {isConnected ? (
          <div className="h-[calc(100vh-140px)]">
             {activeTab === 'dashboard' && <Dashboard />}
             {activeTab === 'explorer' && <TableList onPreview={handlePreview} />}
             {activeTab === 'ai' && <div className="max-w-3xl mx-auto mt-10"><AiQueryBuilder /></div>}
          </div>
        ) : (
          <ConnectionForm />
        )}

        {previewTarget && (
          <PreviewModal 
            schema={previewTarget.schema} 
            table={previewTarget.table} 
            onClose={() => setPreviewTarget(null)} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
