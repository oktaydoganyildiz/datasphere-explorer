import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Trash2, Database, Clock, AlertTriangle, Copy, Check,
  Download, Code2, BookOpen, ChevronRight, Zap, Table as TableIcon
} from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const STORAGE_KEY = 'datasphere_query_history';
const MAX_HISTORY = 100;

const TIPS = [
  {
    category: 'Temel Sorgular',
    items: [
      { label: 'Tablo onizleme', sql: 'SELECT TOP 100 * FROM "{schema}"."{table}"' },
      { label: 'Satir sayisi', sql: 'SELECT COUNT(*) AS TOTAL FROM "{schema}"."{table}"' },
      { label: 'Benzersiz degerler', sql: 'SELECT DISTINCT "{column}" FROM "{schema}"."{table}" ORDER BY 1' },
    ]
  },
  {
    category: 'Filtreleme & Siralama',
    items: [
      { label: 'Tarih filtresi', sql: "SELECT * FROM \"{schema}\".\"TASK_LOGS\"\nWHERE START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7)\nORDER BY START_TIME DESC" },
      { label: 'Durum filtresi', sql: "SELECT * FROM \"{schema}\".\"TASK_LOGS\"\nWHERE STATUS = 'FAILED'\n  AND SPACE_ID != '$$global$$'" },
      { label: 'LIKE arama', sql: "SELECT * FROM \"{schema}\".\"TASK_LOGS\"\nWHERE OBJECT_ID LIKE '%keyword%'" },
    ]
  },
  {
    category: 'Gruplama & Agregasyon',
    items: [
      { label: 'Durum ozeti', sql: "SELECT STATUS, COUNT(*) AS CNT\nFROM \"{schema}\".\"TASK_LOGS\"\nGROUP BY STATUS\nORDER BY CNT DESC" },
      { label: 'Gunluk dagılım', sql: "SELECT TO_DATE(START_TIME) AS GUN, COUNT(*) AS CNT\nFROM \"{schema}\".\"TASK_LOGS\"\nWHERE START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -30)\nGROUP BY TO_DATE(START_TIME)\nORDER BY GUN DESC" },
      { label: 'Space bazında', sql: "SELECT SPACE_ID, STATUS, COUNT(*) AS CNT\nFROM \"{schema}\".\"TASK_LOGS\"\nWHERE SPACE_ID != '$$global$$'\nGROUP BY SPACE_ID, STATUS\nORDER BY SPACE_ID, CNT DESC" },
    ]
  },
  {
    category: 'Sistem Bilgisi',
    items: [
      { label: 'Aktif baglantilar', sql: "SELECT CONNECTION_ID, USER_NAME, CONNECTION_STATUS,\n  CLIENT_HOST, START_TIME\nFROM SYS.M_CONNECTIONS\nWHERE CONNECTION_STATUS = 'RUNNING'" },
      { label: 'Buyuk tablolar', sql: "SELECT TOP 20 SCHEMA_NAME, TABLE_NAME, RECORD_COUNT\nFROM SYS.M_TABLES\nWHERE SCHEMA_NAME = '{schema}'\nORDER BY RECORD_COUNT DESC" },
      { label: 'Tablo kolonlari', sql: "SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, IS_NULLABLE\nFROM SYS.TABLE_COLUMNS\nWHERE SCHEMA_NAME = '{schema}'\n  AND TABLE_NAME = '{table}'\nORDER BY POSITION" },
    ]
  },
  {
    category: 'HANA Ozel',
    items: [
      { label: 'Sure hesapla', sql: "SELECT TASK_LOG_ID, STATUS,\n  SECONDS_BETWEEN(START_TIME, END_TIME) AS SURE_SN\nFROM \"{schema}\".\"TASK_LOGS\"\nWHERE END_TIME IS NOT NULL\nORDER BY SURE_SN DESC" },
      { label: 'String birlestirme', sql: "SELECT SCHEMA_NAME || '.' || TABLE_NAME AS TAM_AD\nFROM SYS.TABLES\nWHERE SCHEMA_NAME = '{schema}'" },
      { label: 'NULL kontrol', sql: "SELECT * FROM \"{schema}\".\"TASK_LOGS\"\nWHERE END_TIME IS NULL\n  AND STATUS = 'RUNNING'" },
    ]
  }
];

const KEYBOARD_HINTS = [
  { keys: 'Ctrl + Enter', desc: 'Calistir' },
  { keys: 'Ctrl + L', desc: 'Temizle' },
  { keys: 'Tab', desc: 'Girinti' },
];

const QueryPlayground = () => {
  const { selectedSchema, schemas, setSelectedSchema } = useConnectionStore();
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);
  const textareaRef = useRef(null);

  const addToHistory = (queryStr, success, rowCount, duration) => {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const newEntry = {
        id: Date.now(),
        sql: queryStr,
        schema: selectedSchema || '',
        duration: duration || null,
        rows: rowCount || 0,
        status: success ? 'success' : 'error',
        timestamp: new Date().toISOString(),
        favorite: false
      };
      const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('History save failed', e);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/query/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        addToHistory(sql, true, data.rowCount, data.duration);
      } else {
        setError(data.message);
        addToHistory(sql, false, 0, 0);
      }
    } catch (err) {
      setError(err.message || 'Execution failed');
      addToHistory(sql, false, 0, 0);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setSql('');
      setResult(null);
      setError(null);
    }
    // Tab indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = sql.substring(0, start) + '  ' + sql.substring(end);
      setSql(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  const insertTip = (tipSql) => {
    const filled = tipSql
      .replace(/\{schema\}/g, selectedSchema || 'SCHEMA_NAME')
      .replace(/\{table\}/g, 'TABLE_NAME')
      .replace(/\{column\}/g, 'COLUMN_NAME');
    setSql(filled);
    textareaRef.current?.focus();
  };

  const copyResult = () => {
    if (!result?.rows?.length) return;
    const headers = Object.keys(result.rows[0]);
    const tsv = [
      headers.join('\t'),
      ...result.rows.map(r => headers.map(h => r[h] ?? '').join('\t'))
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!result?.rows?.length) return;
    const headers = Object.keys(result.rows[0]);
    const csv = [
      headers.join(','),
      ...result.rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor Card - Glass Panel */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden mb-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">SQL Editor</h2>
                <p className="text-[11px] text-slate-500">Serbest SQL sorgusu yazin ve calistirin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <select
                  className="px-2.5 py-1.5 text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-white rounded-lg focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] outline-none"
                  value={selectedSchema || ''}
                  onChange={(e) => setSelectedSchema(e.target.value)}
                >
                  <option value="" disabled>Schema sec</option>
                  {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button
                onClick={() => { setSql(''); setResult(null); setError(null); }}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Temizle (Ctrl+L)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleExecute}
                disabled={loading || !sql.trim()}
                className={
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all " +
                  (loading || !sql.trim()
                    ? 'bg-white/[0.04] text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40')
                }
              >
                {loading ? (
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Calistir
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="relative">
            <div className="absolute top-3 left-3 flex flex-col gap-0.5 select-none pointer-events-none z-10">
              {sql.split('\n').map((_, i) => (
                <span key={i} className="text-[11px] font-mono text-slate-600 leading-[20px] text-right w-6">
                  {i + 1}
                </span>
              ))}
              {!sql && <span className="text-[11px] font-mono text-slate-600 leading-[20px] text-right w-6">1</span>}
            </div>
            <textarea
              ref={textareaRef}
              className="w-full min-h-[200px] max-h-[400px] font-mono text-sm p-3 pl-12 bg-white/[0.02] text-slate-200 outline-none resize-y leading-[20px] placeholder-slate-600 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
              placeholder='SELECT TOP 100 * FROM "FAIR_TRAINING"."MY_TABLE"'
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.02] border-t border-white/[0.05] text-[10px] text-slate-500 font-medium">
            <div className="flex items-center gap-4">
              {KEYBOARD_HINTS.map(h => (
                <span key={h.keys} className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08] font-mono text-[9px]">
                    {h.keys}
                  </kbd>
                  {h.desc}
                </span>
              ))}
            </div>
            <span>{sql.length} karakter</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/[0.06] border border-red-500/15 rounded-xl animate-fade-up">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">Hata</p>
                <p className="text-xs font-mono text-red-400/70 mt-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden animate-fade-up min-h-0">
            {/* Result Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Database className="w-3.5 h-3.5" />
                  {result.rowCount} satir
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {result.duration}ms
                </span>
                {result.limitReached && (
                  <span className="text-amber-400 font-semibold">Limit: 500 satir</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyResult}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  title="Kopyala"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={exportCSV}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  title="CSV Indir"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[400px]">
              {result.rows?.length > 0 ? (
                <table className="min-w-full divide-y divide-white/[0.05]">
                  <thead className="bg-white/[0.04] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-emerald-400/80 uppercase w-10">#</th>
                      {Object.keys(result.rows[0]).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wide whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-3 py-2 text-slate-600 text-[10px]">{i + 1}</td>
                        {Object.values(row).map((val, idx) => (
                          <td key={idx} className="px-3 py-2 whitespace-nowrap text-slate-300">
                            {val === null ? <span className="text-slate-600 italic">NULL</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Sonuc bulunamadi
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tips Panel */}
      {tipsOpen && (
        <div className="w-72 flex-shrink-0 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden animate-fade-in flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">SQL Rehberi</span>
            </div>
            <button
              onClick={() => setTipsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {TIPS.map((section, si) => (
              <div key={si}>
                <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-[0.1em] mb-2 px-1">
                  {section.category}
                </p>
                <div className="space-y-1">
                  {section.items.map((tip, ti) => (
                    <button
                      key={ti}
                      onClick={() => insertTip(tip.sql)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-emerald-400 transition-all group flex items-center gap-2"
                    >
                      <Zap className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity flex-shrink-0" />
                      <span className="truncate">{tip.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Quick Reference */}
            <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-[0.1em] mb-2">
                Hizli Referans
              </p>
              <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                <p><span className="text-amber-400">TOP N</span> - Satir limiti</p>
                <p><span className="text-amber-400">LIKE '%x%'</span> - Metin arama</p>
                <p><span className="text-amber-400">IS NULL</span> - Bos deger</p>
                <p><span className="text-amber-400">GROUP BY</span> - Gruplama</p>
                <p><span className="text-amber-400">ORDER BY .. DESC</span> - Siralama</p>
                <p><span className="text-amber-400">COUNT(*)</span> - Sayim</p>
                <p><span className="text-amber-400">DISTINCT</span> - Benzersiz</p>
                <p><span className="text-amber-400">"COL"</span> - Kolon adi (cift tirnak)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips toggle when closed */}
      {!tipsOpen && (
        <button
          onClick={() => setTipsOpen(true)}
          className="flex-shrink-0 w-10 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors"
          title="SQL Rehberini Ac"
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ writingMode: 'vertical-rl' }}>
            Rehber
          </span>
        </button>
      )}
    </div>
  );
};

export default QueryPlayground;
