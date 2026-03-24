import React, { useState, useEffect } from 'react';
import { Play, Trash2, Database, Clock, AlertTriangle } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { FadeScaleIn, SlideUpIn } from './PageTransition';

const STORAGE_KEY = 'datasphere_query_history';
const MAX_HISTORY = 100;

const QueryPlayground = () => {
  const { selectedSchema, schemas, setSelectedSchema } = useConnectionStore();
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load last query if exists? Or just keep it clean.
    // Maybe load from history if requested, but for now empty.
  }, []);

  const addToHistory = (queryStr, success, rowCount, duration) => {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const newEntry = {
        id: Date.now(),
        sql: queryStr,
        schema: selectedSchema || '',
        duration: duration || null,
        rows: rowCount || 0,
        status: success ? 'success' : 'error',
        timestamp: new Date().toISOString(),
        favorite: false
      };
      // Keep last 100
      const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Dispatch storage event to update other tabs/components
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('History save failed', e);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/query/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        addToHistory(sql, true, data.rowCount, data.duration);
      } else {
        setError(data.message);
        addToHistory(sql, false, 0, 0);
      }
    } catch (err) {
      setError(err.message || 'Execution failed');
      addToHistory(sql, false, 0, 0);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleExecute();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toolbar & Input */}
      <FadeScaleIn delay={0}>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col space-y-3">
          
          <div className="flex justify-between items-center">
             <div className="flex items-center space-x-2 w-1/3">
                <Database className="w-4 h-4 text-gray-500" />
                <select
                  className="w-full p-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm bg-gray-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedSchema || ''}
                  onChange={(e) => setSelectedSchema(e.target.value)}
                >
                  <option value="" disabled>Select Schema</option>
                  {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             
             <div className="flex space-x-2">
               <button
                 onClick={() => setSql('')}
                 className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                 title="Clear SQL"
               >
                 <Trash2 className="w-4 h-4" />
                 <span>Clear</span>
               </button>
               <button
                 onClick={handleExecute}
                 disabled={loading || !sql.trim()}
                 className={`flex items-center space-x-1 px-4 py-1.5 text-sm font-semibold text-white rounded shadow-sm transition-transform active:scale-95 ${
                   loading || !sql.trim()
                     ? 'bg-blue-300 cursor-not-allowed' 
                     : 'bg-green-600 hover:bg-green-700'
                 }`}
                 title="Ctrl+Enter"
               >
                 {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 ) : (
                    <Play className="w-4 h-4 fill-current" />
                 )}
                 <span>Run</span>
               </button>
             </div>
          </div>

          <textarea
            className="w-full h-48 font-mono text-sm p-3 border border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="SELECT * FROM &quot;ANALYTICSTR&quot;.&quot;AIRLINE_VIEW&quot; where YEAR = '2023'"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="text-xs text-gray-400 text-right">
            Press Ctrl+Enter to execute
          </div>
        </div>
      </FadeScaleIn>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <SlideUpIn>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Execution Error</p>
                <p className="font-mono mt-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </SlideUpIn>
        )}

        {result && (
          <SlideUpIn className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
             {/* Result Header */}
             <div className="p-2 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex space-x-3">
                  <span className="flex items-center space-x-1">
                    <Database className="w-3 h-3" />
                    <span>{result.rowCount} rows</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{result.duration}ms</span>
                  </span>
                </div>
                {result.limitReached && (
                  <span className="text-orange-500 font-semibold">
                    Max 500 rows displayed
                  </span>
                )}
             </div>

             {/* Data Table */}
             <div className="flex-1 overflow-auto">
               <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                 <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0">
                   <tr>
                     {result.rows.length > 0 && Object.keys(result.rows[0]).map(key => (
                       <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                         {key}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700 font-mono text-xs">
                   {result.rows.map((row, i) => (
                     <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                       {Object.values(row).map((val, idx) => (
                         <td key={idx} className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-slate-800 last:border-0">
                           {val === null ? <span className="text-gray-400 italic">NULL</span> : String(val)}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </SlideUpIn>
        )}
      </div>
    </div>
  );
};

export default QueryPlayground;
