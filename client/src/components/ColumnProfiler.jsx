import React, { useState, useEffect } from 'react';
import { X, BarChart2, Loader } from 'lucide-react';

const ColumnProfiler = ({ schema, table, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats/profile/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`);
        const json = await res.json();
        if (json.success === false) throw new Error(json.message);
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schema, table]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-800 w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700"
        style={{ animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 rounded-t-xl">
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
               <BarChart2 className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-gray-800 dark:text-white">Column Profile</h2>
               <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                 {schema}.{table}
               </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50 dark:bg-slate-900/20">
          
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Analyzing columns...</p>
            </div>
          )}

          {error && (
             <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
               Error: {error}
             </div>
          )}

          {data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Summary Card */}
              <div className="col-span-full mb-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg flex items-center justify-between">
                 <div>
                   <span className="text-sm text-gray-500 dark:text-blue-300 block">Total Rows</span>
                   <span className="text-2xl font-bold text-blue-700 dark:text-blue-100">{data.totalRows.toLocaleString()}</span>
                 </div>
                 <div>
                    <span className="text-sm text-gray-500 dark:text-blue-300 block">Columns</span>
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-100">{data.columns.length}</span>
                 </div>
                 <div className="text-right">
                    <span className="text-xs text-blue-400 dark:text-blue-300">Analysis Complete</span>
                 </div>
              </div>

              {data.columns.map((col, idx) => {
                const nullPct = data.totalRows > 0 ? (col.nullCount / data.totalRows) * 100 : 0;
                const distinctPct = data.totalRows > 0 ? (col.distinctCount / data.totalRows) * 100 : 0;
                
                return (
                  <div 
                    key={col.column}
                    className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                    style={{ animation: `fadeIn 0.4s ease both ${idx * 0.05}ms` }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-mono font-semibold text-sm text-gray-800 dark:text-gray-100 truncate w-2/3" title={col.column}>
                        {col.column}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                        {col.dataType}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">
                      
                      {/* Nulls */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Nulls</span>
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {col.nullCount.toLocaleString()} ({nullPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${nullPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Distinct */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Distinct</span>
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {col.distinctCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${distinctPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Min/Max */}
                      <div className="pt-2 border-t border-gray-100 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="block text-gray-400">Min</span>
                          <span className="block font-mono text-gray-700 dark:text-gray-300 truncate" title={String(col.min)}>
                            {col.min !== null ? String(col.min) : '-'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-gray-400">Max</span>
                          <span className="block font-mono text-gray-700 dark:text-gray-300 truncate" title={String(col.max)}>
                            {col.max !== null ? String(col.max) : '-'}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ColumnProfiler;
