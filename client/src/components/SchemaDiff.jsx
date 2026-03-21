import React, { useState } from 'react';
import { GitCompare, ChevronDown, ChevronRight, Plus, Minus, RefreshCw, Download } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { FadeScaleIn, SlideUpIn } from './PageTransition';

const diffStyles = `
@keyframes staggerChild { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.diff-row { transition: background .12s ease; }
.diff-row:hover { background: var(--color-background-secondary); }
.diff-row-added   { background: rgba(16,185,129,0.06); border-left: 3px solid #10b981; }
.diff-row-removed { background: rgba(239,68,68,0.06);  border-left: 3px solid #ef4444; }
.diff-row-changed { background: rgba(245,158,11,0.06); border-left: 3px solid #f59e0b; }
.diff-row-same    { border-left: 3px solid transparent; }
`;

if (!document.querySelector('#schema-diff-styles')) {
  const s = document.createElement('style');
  s.id = 'schema-diff-styles';
  s.textContent = diffStyles;
  document.head.appendChild(s);
}

const STATUS = {
  added:   { label: 'Eklendi',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: '+' },
  removed: { label: 'Silindi',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 icon: '−' },
  changed: { label: 'Değişti',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',          icon: '~' },
  same:    { label: 'Aynı',      color: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',               icon: '=' },
};

const Badge = ({ status }) => {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
};

const TableRow = ({ table, index }) => {
  const [open, setOpen] = useState(false);
  const hasColumns = table.columns?.length > 0;
  const rowClass = `diff-row-${table.status}`;

  return (
    <>
      <tr
        className={`diff-row ${rowClass} cursor-pointer`}
        style={{ opacity: 0, animation: `staggerChild .25s ease ${index * 30}ms both` }}
        onClick={() => hasColumns && setOpen(o => !o)}
      >
        <td className="px-4 py-2.5 text-xs font-mono text-gray-900 dark:text-white flex items-center gap-1.5">
          {hasColumns
            ? (open ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />)
            : <span className="w-3" />
          }
          {table.name}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">{table.rowsA ?? '—'}</td>
        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">{table.rowsB ?? '—'}</td>
        <td className="px-4 py-2.5 text-right"><Badge status={table.status} /></td>
      </tr>
      {open && table.columns?.map((col, i) => (
        <tr key={col.name} className={`diff-row diff-row-${col.status} bg-opacity-50`}>
          <td className="px-4 py-1.5 text-xs font-mono text-gray-600 dark:text-gray-400 pl-12 flex items-center gap-1">
            <span className="text-gray-300 dark:text-gray-600">↳</span> {col.name}
            {col.typeA && <span className="text-gray-400 ml-1">({col.typeA}{col.typeB && col.typeA !== col.typeB ? ` → ${col.typeB}` : ''})</span>}
          </td>
          <td colSpan={2} />
          <td className="px-4 py-1.5 text-right"><Badge status={col.status} /></td>
        </tr>
      ))}
    </>
  );
};

const SchemaDiff = () => {
  const { schemas } = useConnectionStore();
  const [schemaA, setSchemaA] = useState('');
  const [schemaB, setSchemaB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('all');

  const runDiff = async () => {
    if (!schemaA || !schemaB) return;
    setLoading(true);
    setResult(null);
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/tables/${encodeURIComponent(schemaA)}`).then(r => r.json()),
        fetch(`/api/tables/${encodeURIComponent(schemaB)}`).then(r => r.json()),
      ]);

      const mapA = new Map((resA || []).map(t => [t.TABLE_NAME, t]));
      const mapB = new Map((resB || []).map(t => [t.TABLE_NAME, t]));
      const allNames = new Set([...mapA.keys(), ...mapB.keys()]);

      const tables = [...allNames].sort().map(name => {
        const a = mapA.get(name);
        const b = mapB.get(name);
        let status = 'same';
        if (!a) status = 'added';
        else if (!b) status = 'removed';
        else if (a.RECORD_COUNT !== b.RECORD_COUNT) status = 'changed';

        return {
          name,
          status,
          rowsA: a?.RECORD_COUNT ?? null,
          rowsB: b?.RECORD_COUNT ?? null,
          typeA: a?.TYPE,
          typeB: b?.TYPE,
          columns: [],
        };
      });

      const stats = {
        added:   tables.filter(t => t.status === 'added').length,
        removed: tables.filter(t => t.status === 'removed').length,
        changed: tables.filter(t => t.status === 'changed').length,
        same:    tables.filter(t => t.status === 'same').length,
        total:   tables.length,
      };

      setResult({ tables, stats });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = result?.tables?.filter(t => filter === 'all' || t.status === filter) ?? [];

  const exportCSV = () => {
    if (!result?.tables) return;
    const rows = [['Tablo', 'Durum', `${schemaA} Satır`, `${schemaB} Satır`]];
    result.tables.forEach(t => rows.push([t.name, t.status, t.rowsA ?? '', t.rowsB ?? '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `diff_${schemaA}_vs_${schemaB}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-5">
      <FadeScaleIn delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Schema Diff</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">İki şema arasındaki farkları karşılaştır</p>
          </div>
        </div>
      </FadeScaleIn>

      <FadeScaleIn delay={60}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Şema A (kaynak)</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                value={schemaA} onChange={e => setSchemaA(e.target.value)}
              >
                <option value="" disabled>Seç…</option>
                {schemas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex items-center pb-2">
              <GitCompare className="w-5 h-5 text-gray-400" />
            </div>

            <div className="flex-1 min-w-40">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Şema B (hedef)</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                value={schemaB} onChange={e => setSchemaB(e.target.value)}
              >
                <option value="" disabled>Seç…</option>
                {schemas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button
              onClick={runDiff}
              disabled={!schemaA || !schemaB || loading || schemaA === schemaB}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
              Karşılaştır
            </button>
          </div>
          {schemaA && schemaB && schemaA === schemaB && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Farklı iki şema seçin.</p>
          )}
        </div>
      </FadeScaleIn>

      {result?.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          {result.error}
        </div>
      )}

      {result?.stats && (
        <SlideUpIn delay={0}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'total',   label: 'Toplam',  color: 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700', text: 'text-gray-800 dark:text-white' },
              { key: 'added',   label: 'Eklendi', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400' },
              { key: 'removed', label: 'Silindi', color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
              { key: 'changed', label: 'Değişti', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
              { key: 'same',    label: 'Aynı',    color: 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700', text: 'text-gray-500 dark:text-gray-400' },
            ].map(({ key, label, color, text }) => (
              <div key={key} className={`rounded-xl border p-4 text-center ${color}`}>
                <p className={`text-2xl font-bold ${text}`}>{result.stats[key]}</p>
                <p className={`text-xs font-medium mt-0.5 ${text}`}>{label}</p>
              </div>
            ))}
          </div>
        </SlideUpIn>
      )}

      {result?.tables && (
        <SlideUpIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1 flex-wrap">
                {[
                  { k: 'all',     l: 'Tümü' },
                  { k: 'added',   l: 'Eklendi' },
                  { k: 'removed', l: 'Silindi' },
                  { k: 'changed', l: 'Değişti' },
                  { k: 'same',    l: 'Aynı' },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filter === k
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {l} {k === 'all' ? `(${result.tables.length})` : `(${result.stats[k]})`}
                  </button>
                ))}
              </div>
              <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV indir
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tablo / Kolon</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{schemaA} Satır</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{schemaB} Satır</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                  {filtered.length === 0
                    ? <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-gray-400">Bu filtreye uygun sonuç yok</td></tr>
                    : filtered.map((t, i) => <TableRow key={t.name} table={t} index={i} />)
                  }
                </tbody>
              </table>
            </div>
          </div>
        </SlideUpIn>
      )}
    </div>
  );
};

export default SchemaDiff;
