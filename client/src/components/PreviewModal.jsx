import React, { useState, useEffect, useRef } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';

const modalStyles = `
@keyframes backdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes backdropOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes modalSlideOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(12px) scale(0.97); }
}
@keyframes dataDots {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
.modal-backdrop-in  { animation: backdropIn  0.2s ease both; }
.modal-backdrop-out { animation: backdropOut 0.18s ease both; }
.modal-panel-in     { animation: modalSlideIn  0.3s cubic-bezier(0.16,1,0.3,1) both; }
.modal-panel-out    { animation: modalSlideOut 0.18s ease both; }
.data-dots { display: flex; gap: 6px; justify-content: center; }
.data-dots span {
  width: 8px; height: 8px; border-radius: 50%;
  background: #3b82f6;
  animation: dataDots 1.4s infinite ease-in-out;
}
.data-dots span:nth-child(2) { animation-delay: 0.2s; }
.data-dots span:nth-child(3) { animation-delay: 0.4s; }
`;

if (!document.querySelector('#preview-modal-styles')) {
  const s = document.createElement('style');
  s.id = 'preview-modal-styles';
  s.textContent = modalStyles;
  document.head.appendChild(s);
}

const PreviewModal = ({ schema, table, onClose }) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/preview`);
        if (!res.ok) throw new Error('Failed to fetch preview data');
        const result = await res.json();
        setColumns(result.columns || []);
        setData(result.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schema, table]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };

  const handleDownload = () => {
    window.open(`/api/export/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`, '_blank');
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`bg-[#0c1021]/95 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-6xl flex flex-col ${closing ? 'modal-panel-out' : 'modal-panel-in'}`}
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-white/[0.02]">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Preview:
              <span className="text-blue-400 font-mono text-base drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">{table}</span>
            </h3>
            <p className="text-sm text-slate-400">
              Schema: {schema} · First 100 rows
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-medium rounded-lg flex items-center transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download Excel
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="data-dots"><span></span><span></span><span></span></div>
              <p className="text-sm text-slate-500">Loading preview data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
              <AlertCircle className="w-10 h-10 mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <table className="min-w-full border-collapse">
              <thead className="bg-white/[0.02] sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.COLUMN_NAME}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-white/[0.06] whitespace-nowrap bg-white/[0.02]"
                    >
                      {col.COLUMN_NAME}
                      <div className="text-[10px] normal-case text-slate-600 font-normal">{col.DATA_TYPE_NAME}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${i}-${col.COLUMN_NAME}`}
                        className="px-4 py-2 text-sm text-slate-300 border-r border-white/[0.03] last:border-0 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                      >
                        {row[col.COLUMN_NAME]?.toString() || (
                          <span className="text-slate-600 italic text-xs">null</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
