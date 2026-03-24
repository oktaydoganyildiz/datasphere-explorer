import React, { useState } from 'react';
import useConnectionStore from './store/connectionStore';
import Sidebar from './components/Sidebar';
import ConnectionForm from './components/ConnectionForm';
import TableList from './components/TableList';
import PreviewModal from './components/PreviewModal';
import Dashboard from './components/Dashboard';
import AiQueryBuilder from './components/AiQueryBuilder';
import HealthMonitor from './components/HealthMonitor';
import CsvImport from './components/CsvImport';
import QueryHistory from './components/QueryHistory';
import PageTransition from './components/PageTransition';
import QueryPlayground from './components/QueryPlayground';
import ColumnProfiler from './components/ColumnProfiler';

const appStyles = `
@keyframes connectionFormIn {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.connection-form-enter { animation: connectionFormIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes staggerChild {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

if (!document.querySelector('#app-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'app-anim-styles';
  s.textContent = appStyles;
  document.head.appendChild(s);
}

const TAB_META = {
  dashboard:    { title: 'System Dashboard',  desc: 'Sistemin genel görünümü ve istatistikler.' },
  explorer:     { title: 'Data Explorer',     desc: 'Şemalar, tablolar ve veri önizleme.' },
  health:       { title: 'Health Monitor',    desc: 'CPU, bellek, disk ve aktif bağlantılar.' },
  ai:           { title: 'AI Assistant',      desc: 'Doğal dil ile SQL üret ve analiz yap.' },
  csvimport:    { title: 'CSV Import',         desc: 'CSV dosyasını HANA\'ya tablo olarak aktar.' },
  queryhistory: { title: 'Query History',     desc: 'Geçmiş sorgularını görüntüle ve yönet.' },
  playground:   { title: 'Query Playground', desc: 'SQL sorgularını doğrudan çalıştır.' },
};

function App() {
  const { isConnected, reset } = useConnectionStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [profilerTarget, setProfilerTarget] = useState(null);

  const handleDisconnect = async () => {
    try { await fetch('/api/connection/disconnect', { method: 'POST' }); } catch {}
    reset();
    setActiveTab('dashboard');
  };

  const meta = TAB_META[activeTab] || TAB_META.dashboard;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      <Sidebar onDisconnect={handleDisconnect} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {isConnected ? meta.title : 'Welcome to DataSphere Explorer'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {isConnected ? meta.desc : 'SAP HANA Cloud veya DataSphere örneğinize bağlanın.'}
          </p>
        </header>

        <div className="flex-1 overflow-auto px-6 pb-6">
          {isConnected ? (
            <PageTransition animKey={activeTab}>
              {activeTab === 'dashboard'    && <Dashboard />}
              {activeTab === 'explorer'     && <TableList onPreview={(s, t) => setPreviewTarget({ schema: s, table: t })} onProfile={(s, t) => setProfilerTarget({ schema: s, table: t })} />}
              {activeTab === 'health'       && <HealthMonitor />}
              {activeTab === 'ai'           && <div className="max-w-3xl mx-auto mt-6"><AiQueryBuilder /></div>}
              {activeTab === 'csvimport'    && <CsvImport />}
              {activeTab === 'queryhistory' && <QueryHistory />}
              {activeTab === 'playground'   && <QueryPlayground />}
            </PageTransition>
          ) : (
            <div className="connection-form-enter"><ConnectionForm /></div>
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

      {profilerTarget && (
        <ColumnProfiler
          schema={profilerTarget.schema}
          table={profilerTarget.table}
          onClose={() => setProfilerTarget(null)}
        />
      )}
    </div>
  );
}

export default App;