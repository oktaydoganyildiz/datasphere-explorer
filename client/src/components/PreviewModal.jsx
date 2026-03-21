import React, { useState, useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';

const PreviewModal = ({ schema, table, onClose }) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/preview`);
        if (!res.ok) throw new Error("Failed to fetch preview data");
        
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

  const handleDownload = () => {
    window.open(`/api/export/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              Preview: <span className="text-blue-600 ml-2">{table}</span>
            </h3>
            <p className="text-sm text-gray-500">Schema: {schema} • First 100 rows</p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleDownload}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 flex items-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Download Excel
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">Loading preview data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <AlertCircle className="w-10 h-10 mb-2" />
              <p>{error}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th key={col.COLUMN_NAME} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      {col.COLUMN_NAME}
                      <div className="text-[10px] normal-case text-gray-400">{col.DATA_TYPE_NAME}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    {columns.map((col) => (
                      <td key={`${i}-${col.COLUMN_NAME}`} className="px-4 py-2 text-sm text-gray-900 border-r border-gray-100 last:border-0 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                         {row[col.COLUMN_NAME]?.toString() || <span className="text-gray-300 italic">null</span>}
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
