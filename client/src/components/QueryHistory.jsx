import React, { useState, useEffect } from 'react';
import { Clock, Star, StarOff, Trash2, Copy, Search, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';

const historyStyles = `
@keyframes staggerChild { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.history-row { transition: background .12s ease; }
.history-row:hover { background: rgba(255,255,255,0.02); }
.history-row:hover .row-actions { opacity: 1; }
.row-actions { opacity: 0; transition: opacity .15s ease; }
`;
if (!document.querySelector('#history-styles')) {
  const s = document.createElement('style');
  s.id = 'history-styles';
  s.textContent = historyStyles;
  document.head.appendChild(s);
}

const STORAGE_KEY = 'datasphere_query_history';
const MAX_HISTORY = 100;

export const addToHistory = (entry) => {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newEntry = {
      id: Date.now(),
      sql: entry.sql,
      schema: entry.schema || '',
      duration: entry.duration || null,
      rows: entry.rows || null,
      status: entry.status || 'success',
      timestamp: new Date().toISOString(),
      favorite: false,
    };
    const updated = [newEntry, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
};

const useHistory = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const load = () => {
      try {
        setItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
      } catch { setItems([]); }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const save = (updated) => {
    setItems(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const toggle = (id, key) => save(items.map(i => i.id === id ? { ...i, [key]: !i[key] } : i));
  const remove = (id) => save(items.filter(i => i.id !== id));
  const clear = () => save([]);

  return { items, toggle, remove, clear };
};

const formatDuration = (ms) => {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatTime = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Az önce';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}dk önce`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}sa önce`;
  return d.toLocaleDateString('tr-TR');
};

const HistoryRow = ({ item, index, onToggleFav, onDelete, onCopy }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(item.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy?.(item);
  };

  return (
    <>
      <tr
        className="history-row cursor-pointer border-b border-white/[0.03]"
        style={{ opacity: 0, animation: `staggerChild .2s ease ${index * 25}ms both` }}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 w-6">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          }
        </td>
        <td className="px-2 py-3">
          {item.status === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-400" />
            : <XCircle className="w-4 h-4 text-red-400" />
          }
        </td>
        <td className="px-3 py-3 max-w-xs">
          <p className="text-xs font-mono text-slate-300 truncate">{item.sql}</p>
          {item.schema && <p className="text-xs text-slate-500 mt-0.5">{item.schema}</p>}
        </td>
        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
          {formatTime(item.timestamp)}
        </td>
        <td className="px-3 py-3 text-xs text-slate-400 text-right whitespace-nowrap">
          {item.rows != null && `${item.rows} satır`}
          {item.duration != null && <span className="ml-1 text-slate-500">{formatDuration(item.duration)}</span>}
        </td>
        <td className="px-4 py-3">
          <div className="row-actions flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button onClick={() => onToggleFav(item.id)} title={item.favorite ? 'Favoriden çıkar' : 'Favorile'} className="p-1.5 rounded hover:bg-white/[0.06] transition-colors">
              {item.favorite ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]" /> : <Star className="w-3.5 h-3.5 text-slate-600" />}
            </button>
            <button onClick={copy} title="Kopyala" className="p-1.5 rounded hover:bg-white/[0.06] transition-colors">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400" />}
            </button>
            <button onClick={() => onDelete(item.id)} title="Sil" className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-slate-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-white/[0.02]">
            <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-all leading-relaxed">{item.sql}</pre>
          </td>
        </tr>
      )}
    </>
  );
};

const QueryHistory = () => {
  const { items, toggle, remove, clear } = useHistory();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = items.filter(item => {
    const matchSearch = !search || item.sql.toLowerCase().includes(search.toLowerCase()) || item.schema?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'favorites' && item.favorite) || filter === item.status;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: items.length,
    success: items.filter(i => i.status === 'success').length,
    failed: items.filter(i => i.status === 'error').length,
    favorites: items.filter(i => i.favorite).length,
  };

  return (
    <div className="p-6 space-y-5">
      <FadeScaleIn delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Query History</h2>
            <p className="text-sm text-slate-400 mt-0.5">Son {MAX_HISTORY} sorgu kaydedilir</p>
          </div>
          {items.length > 0 && (
            <button onClick={clear} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Tümünü temizle
            </button>
          )}
        </div>
      </FadeScaleIn>

      {items.length > 0 && (
        <FadeScaleIn delay={40}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Toplam', value: stats.total, color: 'text-white' },
              { label: 'Başarılı', value: stats.success, color: 'text-emerald-400' },
              { label: 'Hatalı', value: stats.failed, color: 'text-red-400' },
              { label: 'Favori', value: stats.favorites, color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </FadeScaleIn>
      )}

      <SlideUpIn delay={60}>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.03] flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="SQL veya şema ara…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] text-white rounded-lg focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
              />
            </div>
            <div className="flex gap-1">
              {[
                { k: 'all', l: 'Tümü' },
                { k: 'favorites', l: '★ Favori' },
                { k: 'success', l: 'Başarılı' },
                { k: 'error', l: 'Hatalı' },
              ].map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === k
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                      : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Clock className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Henüz sorgu yok</p>
              <p className="text-xs mt-1 text-slate-600">Sorgular Query Playground'dan çalıştırıldıkça burada görünür</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-600">Arama sonucu bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="w-6 px-4 py-2" />
                    <th className="w-6 px-2 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SQL</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Zaman</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Sonuç</th>
                    <th className="px-4 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      index={i}
                      onToggleFav={(id) => toggle(id, 'favorite')}
                      onDelete={remove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SlideUpIn>
    </div>
  );
};

export default QueryHistory;
