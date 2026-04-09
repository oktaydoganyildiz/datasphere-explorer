import React, { useState } from 'react';
import { Sparkles, Send, Copy, AlertCircle, Info, Lightbulb } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const AiQueryBuilder = () => {
  const { selectedSchema } = useConnectionStore();
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(''); // In real app, maybe store this securely or env
  const [sql, setSql] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorHint, setErrorHint] = useState(null);

  const examplePrompts = [
    "Son 7 gündeki başarısız görevleri göster",
    "Bugün çalışan task'ları listele",
    "En uzun süren 10 görevi bul",
    "Show failed tasks from last week",
    "Count tasks by status for today"
  ];

  const handleGenerate = async () => {
    if (!prompt) return;
    if (!apiKey) {
      setError("Lütfen önce OpenRouter API anahtarınızı girin.");
      setErrorHint("https://openrouter.ai/keys adresinden ücretsiz alabilirsiniz.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setErrorHint(null);
    setSql('');
    setExplanation('');

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
      
      if (!data.success) {
        setError(data.message || 'Bir hata oluştu');
        if (data.hint) setErrorHint(data.hint);
        return;
      }
      
      setSql(data.sql);
      setExplanation(data.explanation);
    } catch (err) {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
      setErrorHint('Server çalışıyor mu kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const useExample = (example) => {
    setPrompt(example);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mr-3">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI SQL Generator</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Powered by OpenRouter (StepFun) - Free Tier</p>
        </div>
      </div>

      {/* API Key Input */}
      <div className="mb-4">
        <input
            type="password"
            placeholder="Enter OpenRouter API Key (ücretsiz: openrouter.ai/keys)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full text-xs p-2 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Example Prompts */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Örnek Sorular:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              onClick={() => useExample(example)}
              className="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sorunuzu yazın (Türkçe veya İngilizce)
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleGenerate();
                }
              }}
              placeholder="Örnek: Son 7 gündeki başarısız görevleri göster..."
              className="w-full h-24 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm dark:text-white resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              title="Ctrl+Enter ile de gönderebilirsiniz"
            >
              {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            💡 İpucu: Ctrl+Enter ile gönderebilirsiniz
          </p>
        </div>

        {error && (
          <div className="space-y-2">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md flex items-start">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <div>{error}</div>
                {errorHint && (
                  <div className="mt-1 text-xs opacity-80">
                    <Info className="w-3 h-3 inline mr-1" />
                    {errorHint}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {explanation && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-md">
            💬 {explanation}
          </div>
        )}

        {sql && (
          <div className="relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(sql);
                  // Optional: show a toast notification
                }}
                className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-xs flex items-center"
              >
                <Copy className="w-3 h-3 mr-1" /> Kopyala
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
