import React, { useState, useEffect } from 'react';
import { X, BarChart2 } from 'lucide-react';

const profilerStyles = `
@keyframes dataDots {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.data-dots { display: flex; gap: 6px; justify-content: center; }
.data-dots span {
  width: 8px; height: 8px; border-radius: 50%;
  background: #3b82f6;
  animation: dataDots 1.4s infinite ease-in-out;
}
.data-dots span:nth-child(2) { animation-delay: 0.2s; }
.data-dots span:nth-child(3) { animation-delay: 0.4s; }
.profiler-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.profiler-card:hover {
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 0 20px rgba(96,165,250,0.06), 0 0 40px rgba(96,165,250,0.03);
}
`;

if (!document.querySelector('#profiler-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'profiler-anim-styles';
  s.textContent = profilerStyles;
  document.head.appendChild(s);
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-[#0c1021]/95 backdrop-blur-2xl w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-white/[0.08]"
        style={{ animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >

        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex justify-between items-center bg-white/[0.02] rounded-t-xl">
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
               <BarChart2 className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-white">Column Profile</h2>
               <p className="text-xs text-slate-400 font-mono">
                 {schema}.{table}
               </p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-white/[0.01]">

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="data-dots"><span></span><span></span><span></span></div>
              <p className="text-sm text-slate-500">Analyzing columns...</p>
            </div>
          )}

          {error && (
             <div className="p-4 bg-red-500/[0.06] text-red-400 rounded-lg border border-red-500/15">
               Error: {error}
             </div>
          )}

          {data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Summary Card */}
              <div className="col-span-full mb-2 p-4 bg-blue-500/[0.06] border border-blue-500/15 rounded-lg flex items-center justify-between">
                 <div>
                   <span className="text-sm text-blue-400 block">Total Rows</span>
                   <span className="text-2xl font-bold text-white">{data.totalRows.toLocaleString()}</span>
                 </div>
                 <div>
                    <span className="text-sm text-blue-400 block">Columns</span>
                    <span className="text-2xl font-bold text-white">{data.columns.length}</span>
                 </div>
                 <div className="text-right">
                    <span className="text-xs text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]">Analysis Complete</span>
                 </div>
              </div>

              {data.columns.map((col, idx) => {
                const nullPct = data.totalRows > 0 ? (col.nullCount / data.totalRows) * 100 : 0;
                const distinctPct = data.totalRows > 0 ? (col.distinctCount / data.totalRows) * 100 : 0;

                return (
                  <div
                    key={col.column}
                    className="profiler-card bg-white/[0.03] backdrop-blur-xl p-4 rounded-lg border border-white/[0.06]"
                    style={{ animation: `fadeIn 0.4s ease both ${idx * 50}ms` }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-mono font-semibold text-sm text-white truncate w-2/3" title={col.column}>
                        {col.column}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider bg-white/[0.06] text-slate-400 px-2 py-0.5 rounded">
                        {col.dataType}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">

                      {/* Nulls */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Nulls</span>
                          <span className="text-slate-400 font-medium">
                            {col.nullCount.toLocaleString()} ({nullPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full shadow-[0_0_8px_rgba(248,113,113,0.3)]"
                            style={{ width: `${nullPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Distinct */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Distinct</span>
                          <span className="text-slate-400 font-medium">
                            {col.distinctCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                            style={{ width: `${distinctPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Min/Max */}
                      <div className="pt-2 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="block text-slate-500">Min</span>
                          <span className="block font-mono text-slate-400 truncate" title={String(col.min)}>
                            {col.min !== null ? String(col.min) : '-'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-slate-500">Max</span>
                          <span className="block font-mono text-slate-400 truncate" title={String(col.max)}>
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
