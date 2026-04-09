import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Table, Loader2 } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';
import useConnectionStore from '../store/connectionStore';

const csvStyles = `
.drop-zone { transition: border-color .2s, background .2s; }
.drop-zone.drag-over { border-color: #3b82f6 !important; background: rgba(59,130,246,0.05); }
.csv-table { font-size: 11px; }
.csv-table th, .csv-table td { padding: 4px 10px; white-space: nowrap; }
`;
if (!document.querySelector('#csv-import-styles')) {
  const s = document.createElement('style');
  s.id = 'csv-import-styles';
  s.textContent = csvStyles;
  document.head.appendChild(s);
}

const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV en az 1 başlık ve 1 veri satırı içermeli');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line =>
    line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
};

const inferType = (values) => {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.every(v => /^-?\d+$/.test(v))) return 'INTEGER';
  if (sample.every(v => /^-?\d+\.?\d*$/.test(v))) return 'DOUBLE';
  if (sample.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'DATE';
  return 'NVARCHAR(255)';
};

const CsvImport = () => {
  const { schemas, selectedSchema } = useConnectionStore();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [targetSchema, setTargetSchema] = useState(selectedSchema || '');
  const [tableName, setTableName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    
    const isCsv = f.name.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      setError('Sadece .csv dosyaları destekleniyor');
      return;
    }

    setError(null);
    setImportResult(null);
    setFile(f);
    setTableName(f.name.replace(/\.csv$/i, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const result = parseCSV(e.target.result);
        const headers = result.headers;
        const rows = result.rows;

        const types = headers.map((_, i) => inferType(rows.map(r => r[i])));
        setParsed({ headers, rows, types });
      } catch (err) {
        setError(err.message);
      }
    };

    reader.readAsText(f);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const doImport = async () => {
    if (!parsed || !targetSchema || !tableName) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: targetSchema,
          tableName: tableName.toUpperCase(),
          headers: parsed.headers,
          types: parsed.types,
          rows: parsed.rows,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setImportResult({ success: true, rows: data.rowsInserted, table: data.tableName });
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null); setParsed(null); setError(null);
    setImportResult(null); setTableName('');
  };

  return (
    <div className="p-6 space-y-5">
      <FadeScaleIn delay={0}>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Import Wizard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">CSV dosyasını HANA'ya tablo olarak aktar</p>
        </div>
      </FadeScaleIn>

      {!parsed && (
        <FadeScaleIn delay={60}>
          <div
            className="drop-zone border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-12 text-center cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ borderColor: dragOver ? '#3b82f6' : undefined, background: dragOver ? 'rgba(59,130,246,0.05)' : undefined }}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            <Upload className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Dosyayı sürükle veya tıkla</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">CSV (Maks 5MB)</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
        </FadeScaleIn>
      )}

      {parsed && (
        <>
          <SlideUpIn delay={0}>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {parsed.headers.length} kolon · {parsed.rows.length} satır
                    </p>
                  </div>
                </div>
                <button onClick={reset} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Hedef Şema</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    value={targetSchema} onChange={e => setTargetSchema(e.target.value)}
                  >
                    <option value="" disabled>Seç…</option>
                    {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Tablo Adı</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={e => setTableName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    placeholder="TABLO_ADI"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Kolon tipleri */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Kolon Tipleri (otomatik algılandı)</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.headers.map((h, i) => (
                    <div key={h} className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1">
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{h}</span>
                      <span className="text-xs text-blue-500">:{parsed.types[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={doImport}
                  disabled={importing || !targetSchema || !tableName}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
                  {importing ? 'Aktarılıyor…' : 'HANA\'ya Aktar'}
                </button>
              </div>
            </div>
          </SlideUpIn>

          {/* Önizleme */}
          <SlideUpIn delay={80}>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Önizleme (ilk 5 satır)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="csv-table min-w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-900/50">
                      {parsed.headers.map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-100 dark:border-slate-700 last:border-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        {row.map((cell, j) => (
                          <td key={j} className="text-xs text-gray-700 dark:text-gray-300 font-mono border-r border-gray-100 dark:border-slate-700 last:border-0 max-w-xs overflow-hidden text-ellipsis">
                            {cell || <span className="text-gray-300 dark:text-gray-600 italic">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SlideUpIn>
        </>
      )}

      {importResult && (
        <SlideUpIn delay={0}>
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            importResult.success
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            {importResult.success
              ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            }
            <div className="text-sm">
              {importResult.success ? (
                <>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Aktarım tamamlandı</p>
                  <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                    <span className="font-mono">{targetSchema}.{importResult.table}</span> tablosu oluşturuldu · {importResult.rows} satır eklendi
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-800 dark:text-red-300">Aktarım başarısız</p>
                  <p className="text-red-700 dark:text-red-400 mt-0.5">{importResult.message}</p>
                </>
              )}
            </div>
          </div>
        </SlideUpIn>
      )}
    </div>
  );
};

export default CsvImport;
