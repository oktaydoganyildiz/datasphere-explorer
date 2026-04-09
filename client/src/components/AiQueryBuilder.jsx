import React, { useState } from 'react';
import { Sparkles, Send, Copy, AlertCircle, Info, Lightbulb } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const DataDots = () => (
  <span className="data-dots">
    <span />
    <span />
    <span />
  </span>
);

const AiQueryBuilder = () => {
  const { selectedSchema } = useConnectionStore();
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
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

  const useExample = (example) => setPrompt(example);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-6 flex items-center">
        <div className="mr-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 p-2.5 shadow-[0_0_20px_rgba(96,165,250,0.3)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI SQL Generator</h3>
          <p className="text-xs text-slate-400">Powered by OpenRouter (StepFun) - Free Tier</p>
        </div>
      </div>

      <div className="mb-5">
        <input
          type="password"
          placeholder="Enter OpenRouter API Key (ucretsiz: openrouter.ai/keys)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input-modern font-mono text-xs"
        />
      </div>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-cyan-300" />
          <span className="text-xs font-medium text-slate-300">Ornek Sorular:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              onClick={() => useExample(example)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-blue-300 transition hover:border-blue-400/50 hover:bg-blue-500/10"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Sorunuzu yazin (Turkce veya Ingilizce)
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
              placeholder="Ornek: Son 7 gundeki basarisiz gorevleri goster..."
              className="neon-input h-24 resize-none pr-12 text-sm"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="btn-glow absolute bottom-3 right-3 rounded-md p-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              title="Ctrl+Enter ile de gonderebilirsiniz"
            >
              {loading ? <DataDots /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Ctrl+Enter ile gonderebilirsiniz
          </p>
        </div>

        {error && (
          <div className="space-y-2">
            <div className="flex items-start rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <div>{error}</div>
                {errorHint && (
                  <div className="mt-1 text-xs opacity-90">
                    <Info className="w-3 h-3 inline mr-1" />
                    {errorHint}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {explanation && (
          <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-200">
            {explanation}
          </div>
        )}

        {sql && (
          <div className="relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sql);
                }}
                className="flex items-center rounded border border-white/15 bg-black/40 p-1 text-xs text-slate-200 transition hover:border-blue-400/50 hover:text-white"
              >
                <Copy className="w-3 h-3 mr-1" /> Kopyala
              </button>
            </div>
            <pre className="w-full overflow-x-auto rounded-md border border-white/[0.08] bg-black/40 p-4 font-mono text-sm text-emerald-300">
              <code>{sql}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiQueryBuilder;
