import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Play, Copy, Check, ChevronDown, ChevronUp,
  Database, Clock, AlertTriangle, Table2, BarChart3, RefreshCw,
  Lightbulb, Trash2, Download, Key
} from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { FadeScaleIn } from './PageTransition';

const STORAGE_KEY = 'smartquery_api_key';
const SCHEMA_STORAGE_KEY = 'smartquery_schema';
const TABLE_CACHE_TTL = 24 * 60 * 60 * 1000;

const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[SmartQuery] localStorage read failed for ${key}:`, err?.message || err);
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[SmartQuery] localStorage write failed for ${key}:`, err?.message || err);
  }
};

// Pre-built SQL templates that work without AI
const SQL_TEMPLATES = [
  {
    icon: '🔴',
    text: 'Tasks failed in the last 24 hours',
    sql: `SELECT TASK_LOG_ID, SPACE_ID, APPLICATION_ID, OBJECT_ID, STATUS, "USER", START_TIME, END_TIME
FROM DWC_GLOBAL.TASK_LOGS
WHERE STATUS = 'FAILED'
  AND START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -1)
  AND SPACE_ID != '$$global$$'
ORDER BY START_TIME DESC`
  },
  {
    icon: '⛓️',
    text: 'Failed Task Chains (last 7 days)',
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
    text: 'Task summary by space',
    sql: `SELECT SPACE_ID, STATUS, COUNT(*) as TASK_COUNT
FROM DWC_GLOBAL.TASK_LOGS
WHERE START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7)
  AND SPACE_ID != '$$global$$'
GROUP BY SPACE_ID, STATUS
ORDER BY SPACE_ID, TASK_COUNT DESC`
  },
  {
    icon: '⏱️',
    text: '10 longest-running tasks',
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
    text: 'Task Chain history',
    sql: `SELECT cr.CHAIN_TASK_LOG_ID, cr.TECHNICAL_NAME, cr.SPACE_ID,
  tl.STATUS, tl."USER", tl.START_TIME, tl.END_TIME,
  SECONDS_BETWEEN(tl.START_TIME, tl.END_TIME) as DURATION_SEC
FROM DWC_GLOBAL.TASK_CHAIN_RUNS cr
JOIN DWC_GLOBAL.TASK_LOGS tl ON cr.CHAIN_TASK_LOG_ID = tl.TASK_LOG_ID
ORDER BY tl.START_TIME DESC`
  },
  {
    icon: '⚠️',
    text: 'Error messages (ERROR/WARNING)',
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
    text: 'User-based statistics',
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
  const { selectedSchema, schemas, connectionConfig, setSelectedSchema } = useConnectionStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [apiKey, setApiKey] = useState(() => readLocalStorage(STORAGE_KEY) || '');
  const [showSettings, setShowSettings] = useState(false);
  const [tableCache, setTableCache] = useState({});
  const [tableList, setTableList] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const connectionKeyRef = useRef(null);
  const schemaInitRef = useRef(false);
  const safeSchemas = Array.isArray(schemas) ? schemas.filter(Boolean) : [];
  const safeTableList = Array.isArray(tableList) ? tableList : [];

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) {
      writeLocalStorage(STORAGE_KEY, apiKey);
    }
  }, [apiKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build schema context for AI
  const getSchemaContext = () => {
    if (safeTableList.length > 0) {
      return `
Schema: ${selectedSchema || 'DWC_GLOBAL'}
Available Tables/Views:
${safeTableList.map((table) => `- ${table}`).join('\n')}

Important:
- Use "USER" (quoted) for user column
- STATUS values: COMPLETED, FAILED, RUNNING
- SEVERITY values: ERROR, WARNING, INFO
- SPACE_ID = '$$global$$' for system tasks, exclude these for user tasks
      `.trim();
    }

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

  const getCacheKey = (schemaName) => {
    const host = connectionConfig?.host || 'offline';
    const port = connectionConfig?.port || '0';
    return `${host}:${port}/${schemaName}`;
  };

  const fetchTables = async (schemaName, { forceRefresh = false } = {}) => {
    if (!schemaName) return [];

    const cacheKey = getCacheKey(schemaName);
    const cached = tableCache[cacheKey];
    const isFresh = cached && Date.now() - cached.timestamp < TABLE_CACHE_TTL;

    if (!forceRefresh && isFresh) {
      const cachedTables = Array.isArray(cached.tables) ? cached.tables : [];
      setTableList(cachedTables);
      return cachedTables;
    }

    setTableLoading(true);
    setTableError(null);

    try {
      const res = await fetch(`/api/tables/list?schema=${encodeURIComponent(schemaName)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not fetch table list');
      }
      const rawTables = Array.isArray(data?.tables)
        ? data.tables
        : Array.isArray(data)
        ? data.map((row) => row?.TABLE_NAME)
        : [];
      const normalizedTables = rawTables
        .map((name) => String(name || '').trim())
        .filter(Boolean);

      setTableCache((prev) => ({
        ...prev,
        [cacheKey]: {
          tables: normalizedTables,
          timestamp: Date.now()
        }
      }));
      setTableList(normalizedTables);
      return normalizedTables;
    } catch (err) {
      setTableError(err.message);
      setTableList([]);
      return [];
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (schemaInitRef.current || !safeSchemas.length) {
      return;
    }

    schemaInitRef.current = true;
    const savedSchema = readLocalStorage(SCHEMA_STORAGE_KEY);
    if (savedSchema && safeSchemas.includes(savedSchema) && savedSchema !== selectedSchema) {
      setSelectedSchema(savedSchema);
    }
  }, [schemas, selectedSchema, setSelectedSchema]);

  useEffect(() => {
    if (selectedSchema) {
      writeLocalStorage(SCHEMA_STORAGE_KEY, selectedSchema);
      fetchTables(selectedSchema);
    }
  }, [selectedSchema]);

  useEffect(() => {
    const connectionKey = connectionConfig
      ? `${connectionConfig.host}:${connectionConfig.port}:${connectionConfig.user}`
      : null;

    if (connectionKeyRef.current === null) {
      connectionKeyRef.current = connectionKey;
      return;
    }

    if (connectionKeyRef.current !== connectionKey) {
      setTableCache({});
      setTableList([]);
      setTableError(null);
      connectionKeyRef.current = connectionKey;
    }
  }, [connectionConfig?.host, connectionConfig?.port, connectionConfig?.user]);

  const handleSend = async (questionText = null) => {
    const question = questionText || input.trim();
    if (!question) return;

    if (!apiKey) {
      setShowSettings(true);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please enter your OpenRouter API key in settings first.',
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
          apiKey,
          prompt: question,
          schema: selectedSchema || 'DWC_GLOBAL',
          context: getSchemaContext(),
          tableList
        })
      });

      const aiData = await aiRes.json();

      if (!aiData.success) {
        throw new Error(aiData.message || 'SQL generation failed');
      }

      // Add AI response with SQL
      const aiMsg = {
        role: 'assistant',
        content: aiData.explanation || 'Here is your generated SQL query:',
        sql: aiData.sql,
        timestamp: new Date(),
        status: 'generated',
        invalidTables: aiData.invalidTables || []
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `Sorry, an error occurred: ${err.message}`,
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
      content: 'Using ready-made query template:',
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

  const applySuggestion = (msgIndex, invalidName, suggestedTable) => {
    setMessages((prev) => prev.map((message, index) => {
      if (index !== msgIndex || !message.sql) {
        return message;
      }

      return {
        ...message,
        sql: message.sql.replaceAll(invalidName, suggestedTable),
        invalidTables: (message.invalidTables || []).filter((item) => item.name !== invalidName)
      };
    }));
  };

  const schemaOptions = safeSchemas.length > 0
    ? safeSchemas
    : [selectedSchema || 'DWC_GLOBAL'];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <FadeScaleIn>
        <div className="px-6 py-4 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Smart Query</h2>
                <p className="text-xs text-slate-400">Ask questions in natural language, get SQL, see results</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedSchema || schemaOptions[0] || 'DWC_GLOBAL'}
                  onChange={(e) => setSelectedSchema(e.target.value)}
                  className="px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] text-slate-200 rounded-lg outline-none"
                  style={{ colorScheme: 'dark' }}
                >
                  {schemaOptions.map((schemaName) => (
                    <option key={schemaName} value={schemaName} className="bg-slate-900 text-white">
                      {schemaName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => fetchTables(selectedSchema || schemaOptions[0], { forceRefresh: true })}
                  disabled={!(selectedSchema || schemaOptions[0]) || tableLoading}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-40"
                  title="Refresh table list"
                >
                  <RefreshCw className={`w-4 h-4 ${tableLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition ${
                  apiKey
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-amber-400 hover:bg-amber-500/10 animate-pulse'
                }`}
                title={apiKey ? "API Key set" : "API Key required"}
              >
                <Key className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  title="Clear Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {tableError && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">{tableError}</p>
            </div>
          )}

          {/* API Key Settings Panel */}
          {showSettings && (
            <div className="mt-3 p-4 bg-white/[0.03] backdrop-blur-xl rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-slate-300">OpenRouter API Key</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key like AIzaSy..."
                  className="flex-1 px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] text-white rounded-lg focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] outline-none placeholder-slate-600"
                />
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-600 hover:shadow-lg hover:shadow-indigo-500/25 rounded-lg transition-all"
                >
                  Save
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                You can get a free API key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                  console.groq.com
                </a>. The key is stored in the browser.
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
              <div className="inline-flex p-4 bg-gradient-to-br from-indigo-500/20 to-blue-600/20 rounded-2xl mb-4 border border-indigo-500/20">
                <Lightbulb className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Explore your SAP DataSphere data
              </h3>
              <p className="text-slate-400 mb-6">
                Click on ready-made templates or ask free-form questions (AI key required)
              </p>

              {/* Quick Templates - No AI needed */}
              <div className="mb-6">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Ready-made Queries (One Click)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {SQL_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => runTemplate(t)}
                      className="flex items-center gap-3 p-3 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] transition-all group"
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-sm text-slate-400 group-hover:text-emerald-400 transition-colors">
                        {t.text}
                      </span>
                      <Play className="w-4 h-4 ml-auto text-slate-600 group-hover:text-emerald-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Mode hint */}
              {!apiKey && (
                <p className="text-xs text-slate-500">
                  For free-form questions, <button onClick={() => setShowSettings(true)} className="text-indigo-400 hover:underline">set an API key</button>
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
                <div className="bg-indigo-600/80 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg shadow-indigo-500/20">
                  <p className="text-sm">{msg.content}</p>
                </div>
              )}

              {/* Assistant Message */}
              {msg.role === 'assistant' && (
                <div className="space-y-3">
                  {/* Text */}
                  <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${
                    msg.error
                      ? 'bg-red-500/[0.06] border border-red-500/15'
                      : 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]'
                  }`}>
                    <p className={`text-sm ${msg.error ? 'text-red-400' : 'text-slate-300'}`}>
                      {msg.content}
                    </p>
                  </div>

                  {/* SQL Block */}
                  {msg.sql && (
                    <div className="space-y-3">
                      <div className="bg-black/40 rounded-xl overflow-hidden border border-white/[0.08]">
                        <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/[0.08]">
                          <span className="text-xs text-slate-500 font-medium">SQL</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(msg.sql)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded transition"
                              title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => executeSQL(idx, msg.sql)}
                              disabled={msg.status === 'executing'}
                              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${
                                msg.status === 'executing'
                                  ? 'bg-white/[0.04] text-slate-500'
                                  : msg.status === 'success'
                                  ? 'bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/20'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
                              }`}
                            >
                              {msg.status === 'executing' ? (
                                <div className="flex gap-0.5">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              ) : msg.status === 'success' ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              {msg.status === 'executing' ? 'Running...' : msg.status === 'success' ? 'Executed' : 'Run'}
                            </button>
                          </div>
                        </div>
                        <pre className="p-4 text-sm text-emerald-400 font-mono overflow-x-auto">
                          <code>{msg.sql}</code>
                        </pre>
                      </div>

                      {Array.isArray(msg.invalidTables) && msg.invalidTables.length > 0 && (
                        <div className="space-y-2">
                          {msg.invalidTables.map((item) => (
                            <div key={item.name} className="px-4 py-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
                              <p className="text-sm text-amber-300">
                                <strong>{item.name}</strong> not found. Did you mean this?
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(Array.isArray(item.suggestions) ? item.suggestions : []).map((suggestion) => (
                                  <button
                                    key={`${item.name}-${suggestion.table}`}
                                    onClick={() => applySuggestion(idx, item.name, suggestion.table)}
                                    className="px-3 py-1.5 text-xs rounded-full bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 transition"
                                  >
                                    {suggestion.table}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {msg.status === 'error' && msg.errorMsg && (
                    <div className="flex items-start gap-2 px-4 py-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400 font-mono">{msg.errorMsg}</p>
                    </div>
                  )}

                  {/* Results */}
                  {msg.result && (
                    <ResultsPanel result={msg.result} onExport={() => exportCSV(msg.result.rows)} />
                  )}
                </div>
              )}

              {/* Timestamp */}
              <p className={`text-[10px] text-slate-600 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-slate-400">Generating SQL...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/[0.03] backdrop-blur-xl border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question... (e.g., What tasks failed today?)"
                className="w-full px-4 py-3 pr-12 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 outline-none resize-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className={`p-3 rounded-xl transition-all ${
                loading || !input.trim()
                  ? 'bg-white/[0.04] text-slate-600'
                  : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            Send with Enter - New line with Shift+Enter
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
      <div className="px-4 py-3 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl text-sm text-slate-500">
        No results found
      </div>
    );
  }

  const columns = Object.keys(result.rows[0]);

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <strong className="text-emerald-400">{result.rowCount}</strong> rows
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <strong className="text-slate-300">{result.duration}</strong>ms
          </span>
          {result.limitReached && (
            <span className="text-amber-400 font-medium">Showing max 500</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition"
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="flex bg-white/[0.06] rounded-lg p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('table'); }}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-400'}`}
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('chart'); }}
              className={`p-1.5 rounded transition ${viewMode === 'chart' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-400'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="max-h-80 overflow-auto">
          {viewMode === 'table' ? (
            <table className="min-w-full divide-y divide-white/[0.05]">
              <thead className="bg-white/[0.04] sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-medium text-emerald-400/80 uppercase whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-xs font-mono">
                {result.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                        {row[col] === null ? <span className="text-slate-600 italic">NULL</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-slate-500 text-sm">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              Chart view coming soon...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartQuery;
