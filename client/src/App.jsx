import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TableList from './components/TableList';
import HealthMonitor from './components/HealthMonitor';
import SchemaDiff from './components/SchemaDiff';
import CsvImport from './components/CsvImport';
import QueryHistory from './components/QueryHistory';
import ConnectionModal from './components/ConnectionModal';
import { PageTransition } from './components/PageTransition';
import useConnectionStore from './store/connectionStore';

const TABS = {
  dashboard:     <Dashboard />,
  explorer:      <TableList />,
  health:        <HealthMonitor />,
  schemadiff:    <SchemaDiff />,
  csvimport:     <CsvImport />,
  queryhistory:  <QueryHistory />,
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isConnected, checkConnection } = useConnectionStore();

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-y-auto">
        <PageTransition tab={activeTab}>
          {TABS[activeTab] ?? <Dashboard />}
        </PageTransition>
      </main>
      {!isConnected && <ConnectionModal />}
    </div>
  );
}

export default App;
