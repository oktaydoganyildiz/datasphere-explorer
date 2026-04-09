import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Play, Copy, Check, ChevronDown, ChevronUp,
  Database, Clock, AlertTriangle, Table2, BarChart3, RefreshCw,
  Lightbulb, Trash2, Download, Key, Settings
} from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { FadeScaleIn } from './PageTransition';

const STORAGE_KEY = 'smartquery_api_key';

// Pre-built SQL templates that work without AI
const SQL_TEMPLATES = [
  { 
    icon: '🔴', 
    text: 'Son 24 saatte failed olan task\'lar',
    sql: `SELECT TASK_LOG_ID, SPACE_ID, APPLICATION_ID, OBJECT_ID, STATUS, "USER", START_TIME, END_TIME
FROM DWC_GLOBAL.TASK_LOGS 
WHERE STATUS = 'FAILED' 
  AND START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -1)
  AND SPACE_ID != '$$global$$'
ORDER BY START_TIME DESC`
  },
  { 
    icon: '⛓️', 
    text: 'Failed Task Chain\'ler (son 7 gün)',
    sql: `SELECT TOP 20 cr.TECHNICAL_NAME, cr.SPACE_ID,
  tl.TASK_LOG_ID, tl.STATUS, tl."USER", tl.START_TIME, tl.END_TIME
FROM DWC_GLOBAL.TASK_CHAIN_RUNS cr
JOIN DWC_GLOBAL.TASK_LOGS tl ON cr.CHAIN_TASK_LOG_ID = tl.TASK_LOG_ID
WHERE tl.STATUS = 'FAILED'
  AND tl.START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7)
ORDER BY tl.START_TIME DESC`
  },
  { 
    icon: '📊', 
    text: 'Space bazında task özeti',
    sql: `SELECT SPACE_ID, STATUS, COUNT(*) as TASK_COUNT
FROM DWC_GLOBAL.TASK_LOGS 
WHERE START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7)
  AND SPACE_ID != '$$global$$'
GROUP BY SPACE_ID, STATUS
ORDER BY SPACE_ID, TASK_COUNT DESC`
  },
  { 
    icon: '⏱️', 
    text: 'En uzun süren 10 görev',
    sql: `SELECT TOP 10 TASK_LOG_ID, SPACE_ID, OBJECT_ID, STATUS, 
  SECONDS_BETWEEN(START_TIME, END_TIME) as DURATION_SEC,
  START_TIME, END_TIME
FROM DWC_GLOBAL.TASK_LOGS 
WHERE END_TIME IS NOT NULL
  AND SPACE_ID != '$$global$$'
ORDER BY DURATION_SEC DESC`
  },
  { 
    icon: '🔗', 
    text: 'Task Chain geçmişi',
    sql: `SELECT cr.CHAIN_TASK_LOG_ID, cr.TECHNICAL_NAME, cr.SPACE_ID, 
  tl.STATUS, tl."USER", tl.START_TIME, tl.END_TIME,
  SECONDS_BETWEEN(tl.START_TIME, tl.END_TIME) as DURATION_SEC
FROM DWC_GLOBAL.TASK_CHAIN_RUNS cr
JOIN DWC_GLOBAL.TASK_LOGS tl ON cr.CHAIN_TASK_LOG_ID = tl.TASK_LOG_ID
ORDER BY tl.START_TIME DESC`
  },
  { 
    icon: '⚠️', 
    text: 'Hata mesajları (ERROR/WARNING)',
    sql: `SELECT m.TASK_LOG_ID, m.SEVERITY, m.TEXT, m.TIMESTAMP,
  tl.OBJECT_ID, tl.SPACE_ID
FROM DWC_GLOBAL.TASK_LOG_MESSAGES m
JOIN DWC_GLOBAL.TASK_LOGS tl ON m.TASK_LOG_ID = tl.TASK_LOG_ID
WHERE m.SEVERITY IN ('ERROR', 'WARNING')
  AND m.TIMESTAMP > ADD_DAYS(CURRENT_TIMESTAMP, -1)
ORDER BY m.TIMESTAMP DESC`
  },
  { 
    icon: '👤', 
    text: 'Kullanıcı bazında istatistikler',
    sql: `SELECT "USER", STATUS, COUNT(*) as TASK_COUNT
FROM DWC_GLOBAL.TASK_LOGS 
WHERE START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7)
  AND SPACE_ID != '$$global$$'
  AND "USER" IS NOT NULL
GROUP BY "USER", STATUS
ORDER BY "USER", TASK_COUNT DESC`
  },
];

const SmartQuery = () => {
  const { selectedSchema } = useConnectionStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEY, apiKey);
    }
  }, [apiKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build schema context for AI
  const getSchemaContext = () => {
    return `
Schema: DWC_GLOBAL (SAP DataSphere monitoring tables)
Key Tables:
- TASK_LOGS: Task executions (TASK_LOG_ID, SPACE_ID, APPLICATION_ID, OBJECT_ID, STATUS, START_TIME, END_TIME, "USER", ACTIVITY)
- TASK_CHAIN_RUNS: Task chain executions (CHAIN_TASK_LOG_ID, TECHNICAL_NAME, SPACE_ID, FUTURE_STATUS)
- TASK_CHAIN_RUN_NODES: Chain sub-tasks (CHAIN_TASK_LOG_ID, NODE_ID, TASK_LOG_ID)
- TASK_LOG_MESSAGES: Logs/errors (TASK_LOG_ID, SEVERITY, TEXT, DETAILS, TIMESTAMP)

Important: 
- Use "USER" (quoted) for user column
- STATUS values: COMPLETED, FAILED, RUNNING
- SEVERITY values: ERROR, WARNING, INFO
- SPACE_ID = '$$global$$' for system tasks, exclude these for user tasks
    `.trim();
  };

  const handleSend = async (questionText = null) => {
    const question = questionText || input.trim();
    if (!question) return;

    if (!apiKey) {
      setShowSettings(true);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Lütfen önce OpenRouter API anahtarınızı ayarlara girin.',
        error: true,
        timestamp: new Date()
      }]);
      return;
    }

    setInput('');
    setShowExamples(false);
    
    // Add user message
    const userMsg = { role: 'user', content: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Generate SQL from question
      const aiRes = await fetch('/api/ai/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey,
          prompt: question,
          schema: selectedSchema || 'DWC_GLOBAL',
          context: getSchemaContext()
        })
      });
      
      const aiData = await aiRes.json();
      
      if (!aiData.success) {
        throw new Error(aiData.message || 'SQL generation failed');
      }

      // Add AI response with SQL
      const aiMsg = {
        role: 'assistant',
        content: aiData.explanation || 'İşte oluşturduğum SQL sorgusu:',
        sql: aiData.sql,
        timestamp: new Date(),
        status: 'generated'
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `Üzgünüm, bir hata oluştu: ${err.message}`,
        error: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Direct SQL template execution (no AI needed)
  const runTemplate = (template) => {
    setShowExamples(false);
    
    // Add user message showing what they clicked
    const userMsg = { role: 'user', content: template.text, timestamp: new Date() };
    
    // Add assistant message with the pre-built SQL
    const aiMsg = {
      role: 'assistant',
      content: `📋 Hazır sorgu şablonu kullanılıyor:`,
      sql: template.sql,
      timestamp: new Date(),
      status: 'generated'
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
  };

  const executeSQL = async (msgIndex, sql) => {
    // Update message to show loading
    setMessages(prev => prev.map((m, i) => 
      i === msgIndex ? { ...m, status: 'executing' } : m
    ));

    try {
      const res = await fetch('/api/query/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      
      const data = await res.json();

      if (data.success) {
        setMessages(prev => prev.map((m, i) => 
          i === msgIndex ? { 
            ...m, 
            status: 'success',
            result: data,
            executedAt: new Date()
          } : m
        ));
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessages(prev => prev.map((m, i) => 
        i === msgIndex ? { 
          ...m, 
          status: 'error',
          errorMsg: err.message
        } : m
      ));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const exportCSV = (rows) => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
  };

  const clearChat = () => {
    setMessages([]);
    setShowExamples(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <FadeScaleIn>
        <div className="px-6 py-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Smart Query</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Doğal dilde soru sor, SQL al, sonuçları gör</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition ${
                  apiKey 
                    ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' 
                    : 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 animate-pulse'
                }`}
                title={apiKey ? "API Key ayarlandı" : "API Key gerekli"}
              >
                <Key className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  title="Sohbeti Temizle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* API Key Settings Panel */}
          {showSettings && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">OpenRouter API Key</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... şeklinde API anahtarınızı girin"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  Kaydet
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                  Google AI Studio
                </a>'dan ücretsiz API key alabilirsiniz. Key tarayıcıda saklanır.
              </p>
            </div>
          )}
        </div>
      </FadeScaleIn>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Welcome & Templates */}
        {showExamples && messages.length === 0 && (
          <FadeScaleIn delay={100}>
            <div className="max-w-2xl mx-auto text-center py-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-2xl mb-4">
                <Lightbulb className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                SAP DataSphere verilerinizi keşfedin
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Hazır şablonlara tıklayın veya serbest soru sorun (AI key gerekli)
              </p>
              
              {/* Quick Templates - No AI needed */}
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  ⚡ Hazır Sorgular (Tek Tık)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {SQL_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => runTemplate(t)}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all group"
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">
                        {t.text}
                      </span>
                      <Play className="w-4 h-4 ml-auto text-gray-300 group-hover:text-green-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Mode hint */}
              {!apiKey && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  💡 Serbest sorular için <button onClick={() => setShowSettings(true)} className="text-purple-500 hover:underline">API key ayarlayın</button>
                </p>
              )}
            </div>
          </FadeScaleIn>
        )}

        {/* Chat Messages */}
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${msg.role === 'user' ? 'order-1' : ''}`}>
              {/* User Message */}
              {msg.role === 'user' && (
                <div className="bg-purple-600 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg">
                  <p className="text-sm">{msg.content}</p>
                </div>
              )}

              {/* Assistant Message */}
              {msg.role === 'assistant' && (
                <div className="space-y-3">
                  {/* Text */}
                  <div className={`px-4 py-3 rounded-2xl rounded-bl-md shadow-sm ${
                    msg.error 
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'
                  }`}>
                    <p className={`text-sm ${msg.error ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {msg.content}
                    </p>
                  </div>

                  {/* SQL Block */}
                  {msg.sql && (
                    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                        <span className="text-xs text-slate-400 font-medium">SQL</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(msg.sql)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
                            title="Kopyala"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => executeSQL(idx, msg.sql)}
                            disabled={msg.status === 'executing'}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition ${
                              msg.status === 'executing'
                                ? 'bg-slate-700 text-slate-400'
                                : msg.status === 'success'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            {msg.status === 'executing' ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : msg.status === 'success' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            {msg.status === 'executing' ? 'Çalışıyor...' : msg.status === 'success' ? 'Çalıştırıldı' : 'Çalıştır'}
                          </button>
                        </div>
                      </div>
                      <pre className="p-4 text-sm text-green-400 font-mono overflow-x-auto">
                        <code>{msg.sql}</code>
                      </pre>
                    </div>
                  )}

                  {/* Error Message */}
                  {msg.status === 'error' && msg.errorMsg && (
                    <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600 dark:text-red-400 font-mono">{msg.errorMsg}</p>
                    </div>
                  )}

                  {/* Results */}
                  {msg.result && (
                    <ResultsPanel result={msg.result} onExport={() => exportCSV(msg.result.rows)} />
                  )}
                </div>
              )}

              {/* Timestamp */}
              <p className={`text-[10px] text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">SQL oluşturuluyor...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-t border-gray-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bir soru sorun... (örn: Bugün failed olan task'lar neler?)"
                className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm dark:text-white resize-none"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className={`p-3 rounded-xl transition-all ${
                loading || !input.trim()
                  ? 'bg-gray-200 dark:bg-slate-700 text-gray-400'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/40'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Enter ile gönder • Shift+Enter ile yeni satır
          </p>
        </div>
      </div>
    </div>
  );
};

// Results Panel Component
const ResultsPanel = ({ result, onExport }) => {
  const [viewMode, setViewMode] = useState('table');
  const [expanded, setExpanded] = useState(true);

  if (!result?.rows?.length) {
    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900 rounded-xl text-sm text-gray-500 dark:text-gray-400">
        Sonuç bulunamadı
      </div>
    );
  }

  const columns = Object.keys(result.rows[0]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <strong className="text-gray-700 dark:text-gray-300">{result.rowCount}</strong> satır
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <strong className="text-gray-700 dark:text-gray-300">{result.duration}</strong>ms
          </span>
          {result.limitReached && (
            <span className="text-orange-500 font-medium">Max 500 gösteriliyor</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition"
            title="CSV İndir"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="flex bg-gray-200 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('table'); }}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('chart'); }}
              className={`p-1.5 rounded transition ${viewMode === 'chart' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="max-h-80 overflow-auto">
          {viewMode === 'table' ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-xs font-mono">
                {result.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {row[col] === null ? <span className="text-gray-400 italic">NULL</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              Chart görünümü yakında...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartQuery;
