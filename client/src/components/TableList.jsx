import React, { useState, useEffect } from 'react';
import { Search, Table as TableIcon, Eye, Download, BarChart2 } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { TableRowSkeleton } from './Skeleton';
import { FadeScaleIn } from './PageTransition';

const tableStyles = `
@keyframes rowSlideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.table-row-enter {
  animation: rowSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.table-row-hover {
  transition: background 0.15s ease, transform 0.15s ease;
}
.table-row-hover:hover {
  background: rgba(255, 255, 255, 0.02);
}
.action-icon-btn {
  transition: transform 0.15s ease, color 0.15s ease, filter 0.15s ease;
}
.action-icon-btn:hover {
  transform: scale(1.18);
  filter: drop-shadow(0 0 6px currentColor);
}
.search-input-animated {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.search-input-animated:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(96,165,250,0.15), 0 0 20px rgba(96,165,250,0.1);
}
`;

if (!document.querySelector('#tablelist-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'tablelist-anim-styles';
  s.textContent = tableStyles;
  document.head.appendChild(s);
}

const TableList = ({ onPreview, onProfile }) => {
  const { selectedSchema, schemas, setSelectedSchema, tables, setTables } = useConnectionStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [prevSchema, setPrevSchema] = useState(null);

  useEffect(() => {
    if (!selectedSchema) return;

    const fetchTables = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(selectedSchema)}`);
        const data = await res.json();
        setTables(Array.isArray(data) ? data : []);
      } catch {
        setTables([]);
      } finally {
        setLoading(false);
        setPrevSchema(selectedSchema);
      }
    };

    fetchTables();
  }, [selectedSchema, setTables]);

  const filteredTables = tables.filter(t =>
    t.TABLE_NAME.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = (schema, table) => {
    window.open(`/api/export/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Toolbar */}
      <FadeScaleIn delay={0}>
        <div className="p-4 border-b border-white/[0.05] flex items-center justify-between space-x-4 bg-white/[0.02] rounded-t-lg">
          <div className="w-1/3">
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Schema</label>
            <select
              className="w-full p-2 border border-white/[0.06] rounded-md text-sm bg-white/[0.03] text-white transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              value={selectedSchema || ''}
              onChange={(e) => setSelectedSchema(e.target.value)}
            >
              <option value="" disabled>Select Schema</option>
              {schemas.map(s => (
                <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Search Tables</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by name..."
                className="search-input-animated w-full pl-9 p-2 bg-white/[0.04] border border-white/[0.08] text-white rounded-md text-sm placeholder-slate-500 focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </FadeScaleIn>

      {/* Table content */}
      <div className="flex-1 overflow-auto">
        {!selectedSchema ? (
          <div
            className="flex flex-col items-center justify-center h-full text-slate-500"
            style={{ animation: 'staggerChild 0.4s ease both' }}
          >
            <TableIcon className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">Select a schema to view tables</p>
          </div>
        ) : loading ? (
          <table className="min-w-full">
            <thead className="bg-white/[0.02] sticky top-0">
              <tr>
                {['Name', 'Type', 'Count', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={4} />
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full">
            <thead className="bg-white/[0.02] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Count</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                    No tables match your search
                  </td>
                </tr>
              ) : (
                filteredTables.map((t, i) => (
                  <tr
                    key={t.TABLE_NAME}
                    className="table-row-hover table-row-enter border-b border-white/[0.03] hover:bg-white/[0.02]"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      <span className="flex items-center">
                        {t.TYPE === 'VIEW'
                          ? <Eye className="w-4 h-4 mr-2 text-purple-400 flex-shrink-0" />
                          : <TableIcon className="w-4 h-4 mr-2 text-blue-400 flex-shrink-0" />
                        }
                        {t.TABLE_NAME}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        t.TYPE === 'VIEW'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {t.TYPE}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {t.RECORD_COUNT !== null ? t.RECORD_COUNT.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button
                        onClick={() => onPreview(selectedSchema, t.TABLE_NAME)}
                        className="action-icon-btn text-blue-400 hover:text-blue-300 inline-flex items-center"
                        title="Preview Data"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onProfile?.(selectedSchema, t.TABLE_NAME)}
                        className="action-icon-btn text-purple-400 hover:text-purple-300 inline-flex items-center"
                        title="Profile Columns"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(selectedSchema, t.TABLE_NAME)}
                        className="action-icon-btn text-emerald-400 hover:text-emerald-300 inline-flex items-center"
                        title="Download Excel"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TableList;
