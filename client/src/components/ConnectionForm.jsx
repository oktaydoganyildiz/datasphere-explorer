import React, { useState } from 'react';
import { Loader2, ShieldCheck, Server } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const ConnectionForm = () => {
  const [formData, setFormData] = useState({
    host: '',
    port: '443',
    user: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { setConnected, setSchemas } = useConnectionStore();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Connect
      const res = await fetch('/api/connection/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Connection failed');
      }

      // 2. Fetch Schemas on success
      const schemaRes = await fetch('/api/tables/schemas');
      const schemaData = await schemaRes.json();
      
      setConnected(true, formData);
      setSchemas(schemaData.map(s => s.SCHEMA_NAME));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-center mb-6">
        <div className="p-3 bg-blue-100 rounded-full">
          <Server className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connect to DataSphere</h2>
      <p className="text-center text-gray-500 mb-6 text-sm">Enter your HANA Cloud credentials</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
          <input
            type="text"
            name="host"
            value={formData.host}
            onChange={handleChange}
            placeholder="e.g., my-hana-instance.hana.ondemand.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
          <input
            type="number"
            name="port"
            value={formData.port}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
          <input
            type="text"
            name="user"
            value={formData.user}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Connect Securely
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ConnectionForm;
