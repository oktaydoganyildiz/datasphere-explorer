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
.modal-backdrop-in  { animation: backdropIn  0.2s ease both; }
.modal-backdrop-out { animation: backdropOut 0.18s ease both; }
.modal-panel-in     { animation: modalSlideIn  0.3s cubic-bezier(0.16,1,0.3,1) both; }
.modal-panel-out    { animation: modalSlideOut 0.18s ease both; }
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl flex flex-col ${closing ? 'modal-panel-out' : 'modal-panel-in'}`}
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Preview:
              <span className="text-blue-600 dark:text-blue-400 font-mono text-base">{table}</span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Schema: {schema} · First 100 rows
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg flex items-center transition-colors"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download Excel
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading preview data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <AlertCircle className="w-10 h-10 mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.COLUMN_NAME}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 whitespace-nowrap bg-gray-50 dark:bg-slate-900/50"
                    >
                      {col.COLUMN_NAME}
                      <div className="text-[10px] normal-case text-gray-400 font-normal">{col.DATA_TYPE_NAME}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {data.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-blue-50 dark:hover:bg-slate-700/30 transition-colors"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${i}-${col.COLUMN_NAME}`}
                        className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-100 dark:border-slate-700 last:border-0 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                      >
                        {row[col.COLUMN_NAME]?.toString() || (
                          <span className="text-gray-300 dark:text-gray-600 italic text-xs">null</span>
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
