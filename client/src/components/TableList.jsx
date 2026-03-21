import React, { useState, useEffect } from 'react';
import { Search, Table as TableIcon, Eye, Download, FileSpreadsheet } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const TableList = ({ onPreview }) => {
  const { selectedSchema, schemas, setSelectedSchema, tables, setTables } = useConnectionStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch tables when schema changes
  useEffect(() => {
    if (!selectedSchema) return;

    const fetchTables = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(selectedSchema)}`);
        const data = await res.json();
        setTables(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch tables", err);
      } finally {
        setLoading(false);
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
    <div className="flex-1 flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between space-x-4 bg-gray-50 rounded-t-lg">
        <div className="w-1/3">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Schema</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
            value={selectedSchema || ''}
            onChange={(e) => setSelectedSchema(e.target.value)}
          >
            <option value="" disabled>Select Schema</option>
            {schemas.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Search Tables</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name..."
              className="w-full pl-9 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-0">
        {!selectedSchema ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <TableIcon className="w-12 h-12 mb-2 opacity-50" />
            <p>Select a schema to view tables</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            Loading tables...
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTables.map((t) => (
                <tr key={t.TABLE_NAME} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                     {t.TYPE === 'VIEW' ? <Eye className="w-4 h-4 mr-2 text-purple-400"/> : <TableIcon className="w-4 h-4 mr-2 text-blue-400"/>}
                     {t.TABLE_NAME}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.TYPE === 'VIEW' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                      {t.TYPE}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {t.RECORD_COUNT !== null ? t.RECORD_COUNT.toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
                      onClick={() => onPreview(selectedSchema, t.TABLE_NAME)}
                      className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                      title="Preview Data"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownload(selectedSchema, t.TABLE_NAME)}
                      className="text-green-600 hover:text-green-900 inline-flex items-center"
                      title="Download Excel"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TableList;
