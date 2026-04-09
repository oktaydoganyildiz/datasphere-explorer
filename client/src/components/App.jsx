import React, { useState } from 'react';
import useConnectionStore from '../store/connectionStore';
import Sidebar from './Sidebar';
import ConnectionForm from './ConnectionForm';
import TableList from './TableList';
import PreviewModal from './PreviewModal';
import Dashboard from './Dashboard';
import SmartQuery from './SmartQuery';
import HealthMonitor from './HealthMonitor';
import CsvImport from './CsvImport';
import QueryHistory from './QueryHistory';
import QueryPlayground from './QueryPlayground';
import PageTransition from './PageTransition';

const TAB_META = {
  dashboard:    { title: 'System Dashboard',  desc: 'Sistemin genel gorunumu ve istatistikler.' },
  explorer:     { title: 'Data Explorer',     desc: 'Semalar, tablolar ve veri onizleme.' },
  health:       { title: 'Health Monitor',    desc: 'Task Chain izleme ve hata takibi.' },
  smartquery:   { title: 'Smart Query',       desc: 'Dogal dil ile SQL uret ve calistir.', fullWidth: true },
  sqleditor:    { title: 'SQL Editor',        desc: 'Serbest SQL sorgusu yazin ve calistirin.' },
  csvimport:    { title: 'CSV Import',        desc: 'CSV dosyalarini tabloya aktarin.' },
  queryhistory: { title: 'Query History',     desc: 'Sorgu gecmisi ve favoriler.' },
};

function App() {
  const { isConnected, reset } = useConnectionStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewTarget, setPreviewTarget] = useState(null);

  const handleDisconnect = async () => {
    try { await fetch('/api/connection/disconnect', { method: 'POST' }); } catch {}
    reset();
    setActiveTab('dashboard');
  };

  const meta = TAB_META[activeTab] || TAB_META.dashboard;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-surface-0 overflow-hidden transition-colors duration-300">
      <Sidebar onDisconnect={handleDisconnect} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 overflow-hidden flex flex-col relative mesh-bg noise-overlay">
        {/* Header */}
        {!meta.fullWidth && (
          <header className="px-8 pt-7 pb-5 flex-shrink-0 relative z-10">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isConnected ? meta.title : 'Welcome to DataSphere Explorer'}
            </h1>
            <p className="text-gray-500 dark:text-slate-500 text-sm mt-1 font-medium">
              {isConnected ? meta.desc : 'SAP HANA Cloud veya DataSphere orneginize baglanin.'}
            </p>
          </header>
        )}

        <div className={`flex-1 overflow-auto relative z-10 ${meta.fullWidth ? '' : 'px-8 pb-8'}`}>
          {isConnected ? (
            <PageTransition animKey={activeTab}>
              {activeTab === 'dashboard'    && <Dashboard />}
              {activeTab === 'explorer'     && <TableList onPreview={(s, t) => setPreviewTarget({ schema: s, table: t })} />}
              {activeTab === 'health'       && <HealthMonitor />}
              {activeTab === 'smartquery'   && <SmartQuery />}
              {activeTab === 'sqleditor'    && <QueryPlayground />}
              {activeTab === 'csvimport'    && <CsvImport />}
              {activeTab === 'queryhistory' && <QueryHistory />}
            </PageTransition>
          ) : (
            <div className="animate-fade-up px-8">
              <ConnectionForm />
            </div>
          )}
        </div>
      </main>

      {previewTarget && (
        <PreviewModal
          schema={previewTarget.schema}
          table={previewTarget.table}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}

export default App;
