import React, { useState } from 'react';
import { Loader2, ShieldCheck, Server, ArrowRight } from 'lucide-react';
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
      const res = await fetch('/api/connection/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const text = await res.text();
      if (!text) throw new Error('Sunucudan bos yanit geldi. Backend calisiyor mu?');

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Sunucudan gecersiz yanit: ' + text.slice(0, 100));
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Baglanti basarisiz');
      }

      const schemaRes = await fetch('/api/tables/schemas');
      const schemaText = await schemaRes.text();
      if (!schemaText) throw new Error('Sema listesi alinamadi.');

      let schemaData;
      try {
        schemaData = JSON.parse(schemaText);
      } catch {
        throw new Error('Sema yaniti gecersiz: ' + schemaText.slice(0, 100));
      }

      setConnected(true, formData);
      setSchemas(schemaData.map(s => s.SCHEMA_NAME));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6">
      {/* Card */}
      <div className="glass-card rounded-2xl p-8 animate-scale-in">
        {/* Icon */}
        <div className="flex items-center justify-center mb-7">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
              <Server className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-[3px] border-white dark:border-surface-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white tracking-tight">
          Connect to DataSphere
        </h2>
        <p className="text-center text-gray-500 dark:text-slate-500 mb-7 text-sm mt-1.5 font-medium">
          Enter your HANA Cloud credentials
        </p>

        {error && (
          <div className="mb-5 p-4 bg-red-50/80 dark:bg-red-500/[0.08] text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200/50 dark:border-red-500/10 whitespace-pre-wrap break-all font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Host
            </label>
            <input
              type="text"
              name="host"
              value={formData.host}
              onChange={handleChange}
              placeholder="e.g., my-hana-instance.hana.ondemand.com"
              className="input-modern"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Port
            </label>
            <input
              type="number"
              name="port"
              value={formData.port}
              onChange={handleChange}
              className="input-modern"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              User
            </label>
            <input
              type="text"
              name="user"
              value={formData.user}
              onChange={handleChange}
              className="input-modern"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-modern"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-5 rounded-xl text-sm btn-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-6"
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
                <ArrowRight className="w-4 h-4 ml-2 opacity-60" />
              </>
            )}
          </button>
        </form>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-6 pt-5 border-t border-gray-100 dark:border-white/5">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-wider">
            SSL Encrypted
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-wider">
            SAP Certified
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionForm;
