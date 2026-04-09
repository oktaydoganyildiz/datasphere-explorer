import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useConnectionStore from './store/connectionStore';
import DatasphereLanding from './components/DatasphereLanding';
import Sidebar from './components/Sidebar';
import ConnectionForm from './components/ConnectionForm';
import TableList from './components/TableList';
import PreviewModal from './components/PreviewModal';
import Dashboard from './components/Dashboard';
import SmartQuery from './components/SmartQuery';
import QueryPlayground from './components/QueryPlayground';
import HealthMonitor from './components/HealthMonitor';
import CsvImport from './components/CsvImport';
import QueryHistory from './components/QueryHistory';
import PageTransition from './components/PageTransition';
import ColumnProfiler from './components/ColumnProfiler';
import NeuralBackground from './components/NeuralBackground';

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
  dashboard:    { title: 'System Dashboard',  desc: 'System overview and operational metrics.' },
  explorer:     { title: 'Data Explorer',     desc: 'Schemas, tables, and data preview.' },
  health:       { title: 'Health Monitor',    desc: 'Task chain monitoring and error tracking.' },
  smartquery:   { title: 'Smart Query',       desc: 'Generate and run SQL from natural language.', fullWidth: true },
  sqleditor:    { title: 'SQL Editor',        desc: 'Write and run custom SQL queries.', fullWidth: true },
  csvimport:    { title: 'CSV Import',        desc: 'Import a CSV file into HANA as a table.' },
  queryhistory: { title: 'Query History',     desc: 'Review and manage previous queries.' },
};

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function App() {
  const { isConnected, reset } = useConnectionStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [profilerTarget, setProfilerTarget] = useState(null);
  const [showLanding, setShowLanding] = useState(true);

  const handleDisconnect = async () => {
    try { await fetch('/api/connection/disconnect', { method: 'POST' }); } catch {}
    reset();
    setShowLanding(true);
    setActiveTab('dashboard');
  };

  const handleEnterApp = () => {
    setShowLanding(false);
  };

  const meta = TAB_META[activeTab] || TAB_META.dashboard;

  // Show landing page when not connected and showLanding is true
  if (!isConnected && showLanding) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          className="dark"
        >
          <DatasphereLanding onEnter={handleEnterApp} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="dark" style={{ background: '#050810' }}>
      <NeuralBackground opacity={0.42} />
      <motion.div
        key="app"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex h-screen overflow-hidden"
      >
        <Sidebar onDisconnect={handleDisconnect} activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header - hide for fullWidth tabs */}
          {!meta.fullWidth && (
            <header className="px-6 pt-6 pb-4 flex-shrink-0">
              <h1 className="text-2xl font-bold text-white">
                {isConnected ? meta.title : 'Welcome to DataSphere Explorer'}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {isConnected ? meta.desc : 'Connect to your SAP HANA Cloud or DataSphere instance.'}
              </p>
            </header>
          )}

          <div className={`flex-1 overflow-auto ${meta.fullWidth ? '' : 'px-6 pb-6'}`}>
            {isConnected ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <PageTransition animKey={activeTab}>
                    {activeTab === 'dashboard'    && <Dashboard />}
                    {activeTab === 'explorer'     && <TableList onPreview={(s, t) => setPreviewTarget({ schema: s, table: t })} onProfile={(s, t) => setProfilerTarget({ schema: s, table: t })} />}
                    {activeTab === 'health'       && <HealthMonitor />}
                    {activeTab === 'smartquery'   && <SmartQuery />}
                    {activeTab === 'sqleditor'    && <QueryPlayground />}
                    {activeTab === 'csvimport'    && <CsvImport />}
                    {activeTab === 'queryhistory' && <QueryHistory />}
                  </PageTransition>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="connection-form-enter px-6"><ConnectionForm /></div>
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
      </motion.div>
    </div>
  );
}

export default App;
