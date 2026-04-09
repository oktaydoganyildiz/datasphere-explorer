import React, { useState } from 'react';
import { ShieldCheck, Server, ArrowRight } from 'lucide-react';
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
      if (!text) throw new Error('Empty response from server. Is the backend running?');

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server: ' + text.slice(0, 100));
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Connection failed');
      }

      const schemaRes = await fetch('/api/tables/schemas');
      const schemaText = await schemaRes.text();
      if (!schemaText) throw new Error('Schema list could not be loaded.');

      let schemaData;
      try {
        schemaData = JSON.parse(schemaText);
      } catch {
        throw new Error('Invalid schema response: ' + schemaText.slice(0, 100));
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
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 animate-scale-in">
        {/* Icon */}
        <div className="flex items-center justify-center mb-7">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Server className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-[3px] border-black/80 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.4)]">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-center text-white tracking-tight">
          Connect to DataSphere
        </h2>
        <p className="text-center text-slate-400 mb-7 text-sm mt-1.5 font-medium">
          Enter your HANA Cloud credentials
        </p>

        {error && (
          <div className="mb-5 p-4 bg-red-500/[0.08] border border-red-500/20 text-red-400 text-sm rounded-xl whitespace-pre-wrap break-all font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Host
            </label>
            <input
              type="text"
              name="host"
              value={formData.host}
              onChange={handleChange}
              placeholder="e.g., my-hana-instance.hana.ondemand.com"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] focus:bg-white/[0.06]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Port
            </label>
            <input
              type="number"
              name="port"
              value={formData.port}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] focus:bg-white/[0.06]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              User
            </label>
            <input
              type="text"
              name="user"
              value={formData.user}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] focus:bg-white/[0.06]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] focus:bg-white/[0.06]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-6"
          >
            {loading ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                <span className="ml-2">Connecting...</span>
              </div>
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
        <div className="flex items-center justify-center gap-4 mt-6 pt-5 border-t border-white/[0.05]">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            SSL Encrypted
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            SAP Certified
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionForm;
