import React, { useState } from 'react';
import { Sparkles, Send, Copy, AlertCircle } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const AiQueryBuilder = () => {
  const { selectedSchema } = useConnectionStore();
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(''); // In real app, maybe store this securely or env
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    if (!apiKey) {
      setError("Please enter a Gemini API Key first.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSql('');

    try {
      const res = await fetch('/api/ai/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey, 
          prompt, 
          schema: selectedSchema 
        })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      setSql(data.sql);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mr-3">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI SQL Generator</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Google Gemini</p>
        </div>
      </div>

      {/* API Key Input (Temporary Solution) */}
      <div className="mb-4">
        <input
            type="password"
            placeholder="Enter Gemini API Key (not stored)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ask a question about your data
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Show me top 10 customers by sales amount in 2023..."
              className="w-full h-24 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm dark:text-white resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        {sql && (
          <div className="relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => navigator.clipboard.writeText(sql)}
                className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-xs flex items-center"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </button>
            </div>
            <pre className="w-full p-4 bg-slate-900 text-green-400 rounded-md font-mono text-sm overflow-x-auto">
              <code>{sql}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiQueryBuilder;
