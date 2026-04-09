import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Table } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';
import useConnectionStore from '../store/connectionStore';

const csvStyles = `
.drop-zone { transition: border-color .2s, background .2s; }
.drop-zone.drag-over { border-color: rgba(96,165,250,0.5) !important; background: rgba(59,130,246,0.03); }
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
          <h2 className="text-2xl font-bold text-white">Import Wizard</h2>
          <p className="text-sm text-slate-400 mt-0.5">CSV dosyasını HANA'ya tablo olarak aktar</p>
        </div>
      </FadeScaleIn>

      {!parsed && (
        <FadeScaleIn delay={60}>
          <div
            className={`drop-zone border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500/50 bg-blue-500/[0.03]' : 'border-white/[0.1]'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Dosyayı sürükle veya tıkla</p>
            <p className="text-xs text-slate-500 mt-1">CSV (Maks 5MB)</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/[0.06] border border-red-500/15 rounded-lg text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
        </FadeScaleIn>
      )}

      {parsed && (
        <>
          <SlideUpIn delay={0}>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {parsed.headers.length} kolon · {parsed.rows.length} satır
                    </p>
                  </div>
                </div>
                <button onClick={reset} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Hedef Şema</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] text-white rounded-lg focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
                    value={targetSchema} onChange={e => setTargetSchema(e.target.value)}
                  >
                    <option value="" disabled>Seç…</option>
                    {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Tablo Adı</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={e => setTableName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    placeholder="TABLO_ADI"
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] text-white font-mono rounded-lg focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
                  />
                </div>
              </div>

              {/* Column types */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Kolon Tipleri (otomatik algılandı)</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.headers.map((h, i) => (
                    <div key={h} className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1">
                      <span className="text-xs font-mono text-slate-400">{h}</span>
                      <span className="text-xs text-blue-400">:{parsed.types[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={doImport}
                  disabled={importing || !targetSchema || !tableName}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_16px_rgba(59,130,246,0.25)] hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]"
                >
                  {importing ? <div className="data-dots"><span></span><span></span><span></span></div> : <Table className="w-4 h-4" />}
                  {importing ? 'Aktarılıyor…' : 'HANA\'ya Aktar'}
                </button>
              </div>
            </div>
          </SlideUpIn>

          {/* Preview */}
          <SlideUpIn delay={80}>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.03]">
                <p className="text-sm font-semibold text-white">Önizleme (ilk 5 satır)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="csv-table min-w-full">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      {parsed.headers.map(h => (
                        <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-white/[0.03] last:border-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        {row.map((cell, j) => (
                          <td key={j} className="text-xs text-slate-400 font-mono border-r border-white/[0.03] last:border-0 max-w-xs overflow-hidden text-ellipsis">
                            {cell || <span className="text-slate-600 italic">null</span>}
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
              ? 'bg-emerald-500/[0.06] border-emerald-500/15'
              : 'bg-red-500/[0.06] border-red-500/15'
          }`}>
            {importResult.success
              ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            }
            <div className="text-sm">
              {importResult.success ? (
                <>
                  <p className="font-semibold text-emerald-300">Aktarım tamamlandı</p>
                  <p className="text-emerald-400/80 mt-0.5">
                    <span className="font-mono">{targetSchema}.{importResult.table}</span> tablosu oluşturuldu · {importResult.rows} satır eklendi
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-300">Aktarım başarısız</p>
                  <p className="text-red-400/80 mt-0.5">{importResult.message}</p>
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
