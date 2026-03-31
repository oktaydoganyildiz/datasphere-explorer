import React, { useState, useEffect, useCallback } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity, Cpu, HardDrive, Database, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, Server, AlertCircle, Play, Calendar, Lock } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';
import { StatCardSkeleton } from './Skeleton';

const healthStyles = `
@keyframes spin-slow { to { transform: rotate(360deg); } }
.spin-slow { animation: spin-slow 2s linear infinite; }
.conn-row { transition: background .15s ease; }
.conn-row:hover { background: var(--color-background-secondary); }
.refresh-btn { transition: transform .2s ease; }
.refresh-btn:hover { transform: rotate(45deg); }
.metric-card { transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
.metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px -4px rgba(0,0,0,.1); }
@keyframes staggerChild { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
`;

if (!document.querySelector('#health-monitor-styles')) {
  const s = document.createElement('style');
  s.id = 'health-monitor-styles';
  s.textContent = healthStyles;
  document.head.appendChild(s);
}

const getColor = (pct) => {
  if (pct >= 90) return '#E24B4A';
  if (pct >= 75) return '#EF9F27';
  return '#1D9E75';
};

const getStatus = (pct) => {
  if (pct >= 90) return { label: 'Kritik', cls: 'text-red-600 dark:text-red-400' };
  if (pct >= 75) return { label: 'Yüksek', cls: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Normal', cls: 'text-emerald-600 dark:text-emerald-400' };
};

const GaugeCard = ({ title, pct, icon: Icon, usedGb, totalGb, delay = 0 }) => {
  const color = getColor(pct);
  const status = getStatus(pct);
  return (
    <FadeScaleIn delay={delay}>
      <div className="metric-card bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 flex flex-col items-center">
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{title}</span>
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
        <div style={{ width: 130, height: 130, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius={42} outerRadius={60} startAngle={220} endAngle={-40} data={[{ value: Math.max(pct, 2) }]} barSize={14}>
              <RadialBar background={{ fill: 'var(--color-background-secondary)' }} dataKey="value" cornerRadius={7} fill={color} animationDuration={1200} animationEasing="ease-out" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>{pct.toFixed(0)}%</span>
          </div>
        </div>
        <span className={`text-xs font-medium mt-1 ${status.cls}`}>{status.label}</span>
        {usedGb !== undefined && totalGb > 0 && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{usedGb.toFixed(1)} / {totalGb.toFixed(1)} GB</p>
        )}
      </div>
    </FadeScaleIn>
  );
};

const REFRESH_INTERVAL = 30000;

const HealthMonitor = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const [isMock, setIsMock] = useState(false);

  const MOCK = {
    cpu:  { pct: 38 },
    mem:  { pct: 61, usedGb: 9.8, totalGb: 16 },
    disk: { pct: 47, usedGb: 188, totalGb: 400 },
    diskDetails: [],
    connections: [],
    expensiveStatements: [],
    taskLogs: [],
    taskSchedules: [],
    taskErrors: [],
    taskLocks: [],
  };

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/stats/health');
      const json = await res.json();
      const hasReal = json.cpu?.pct > 0 || json.mem?.pct > 0 || json.disk?.pct > 0;
      if (hasReal) {
        setData(json);
        setIsMock(false);
      } else {
        setData({ ...MOCK, connections: json.connections || [], expensiveStatements: json.expensiveStatements || [] });
        setIsMock(true);
      }
    } catch {
      setData(MOCK);
      setIsMock(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => {
    const iv = setInterval(() => fetchHealth(true), REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchHealth]);
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const allGood = data && data.cpu.pct < 75 && data.mem.pct < 75 && data.disk.pct < 75;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <FadeScaleIn delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Health Monitor</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {lastUpdated ? `Son güncelleme: ${lastUpdated.toLocaleTimeString('tr-TR')} · ${countdown}s sonra yenilenir` : 'Yükleniyor…'}
              {isMock && <span className="ml-2 text-xs text-amber-500"> (örnek veri)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                allGood ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
              }`}>
                {allGood ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {allGood ? 'Tüm sistemler normal' : 'Dikkat gerekiyor'}
              </div>
            )}
            <button onClick={() => fetchHealth(true)} className="refresh-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'spin-slow' : ''}`} />
            </button>
          </div>
        </div>
      </FadeScaleIn>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <GaugeCard title="CPU Kullanımı" pct={data.cpu.pct}  icon={Cpu}       delay={0}   />
          <GaugeCard title="Bellek"        pct={data.mem.pct}  icon={Activity}  delay={80}  usedGb={data.mem.usedGb}  totalGb={data.mem.totalGb}  />
          <GaugeCard title="Disk"          pct={data.disk.pct} icon={HardDrive} delay={160} usedGb={data.disk.usedGb} totalGb={data.disk.totalGb} />
        </div>
      )}

      {isMock && !loading && (
        <SlideUpIn delay={200}>
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">Sistem tablosu yetkisi gerekli</p>
              <p className="text-amber-700 dark:text-amber-400">
                Gerçek CPU/Bellek/Disk verisi için kullanıcınıza şu tablolara SELECT yetkisi verin:
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['SYS.M_LOAD_HISTORY_SERVICE', 'SYS.M_HOST_RESOURCE_UTILIZATION', 'SYS.M_DISK_USAGE', 'SYS.M_CONNECTIONS', 'SYS.M_EXPENSIVE_STATEMENTS'].map(t => (
                  <code key={t} className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-amber-800 dark:text-amber-300">{t}</code>
                ))}
              </div>
            </div>
          </div>
        </SlideUpIn>
      )}

      <SlideUpIn delay={300}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />Aktif Bağlantılar
            </h3>
            <span className="text-xs text-gray-400">{data?.connections?.length ?? 0} bağlantı</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              {['ID', 'Kullanıcı', 'Host', 'Durum', 'İşlem', 'Süre'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.connections?.length > 0 ? data.connections.map((c, i) => (
                <tr key={c.CONNECTION_ID} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-900 dark:text-white">#{c.CONNECTION_ID}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{c.USER_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{c.CLIENT_HOST}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.CONNECTION_STATUS === 'RUNNING' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {c.CONNECTION_STATUS === 'RUNNING' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
                      {c.CONNECTION_STATUS}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{c.STMT_TYPE || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">{c.DURATION_S != null ? `${c.DURATION_S}s` : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                  Aktif bağlantı bulunamadı
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={450}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />En Yavaş Sorgular
            </h3>
            <span className="text-xs text-gray-400">SYS.M_EXPENSIVE_STATEMENTS</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Süre (ms)</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Çalışma</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SQL</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.expensiveStatements?.length > 0 ? data.expensiveStatements.map((s, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 60}ms both` }}>
                  <td className="px-4 py-2.5 text-xs text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">{Number(s.DURATION_MS).toLocaleString()} ms</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">{s.EXECUTION_COUNT}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-600 dark:text-gray-400 max-w-xs truncate">{s.STATEMENT_STRING?.slice(0, 80)}…</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400">Sorgu kaydı yok</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </SlideUpIn>

      <SlideUpIn delay={550}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-500" />Disk Detayları
            </h3>
            <span className="text-xs text-gray-400">SYS.M_DISKS</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Volume</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tip</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kullanılan</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Toplam</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">%</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.diskDetails?.length > 0 ? data.diskDetails.map((d, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700 dark:text-gray-300">{d.VOLUME_ID}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{d.FILE_TYPE}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-gray-700 dark:text-gray-300">{d.USED_GB} GB</td>
                  <td className="px-4 py-2.5 text-xs text-right text-gray-500 dark:text-gray-400">{d.TOTAL_GB} GB</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.USAGE_PCT >= 90 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      d.USAGE_PCT >= 75 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>{d.USAGE_PCT}%</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">Disk verisi yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={600}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-500" />Görev Performansı (PEAK CPU/MEMORY)
            </h3>
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_LOGS_V_EXT</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Görev</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aktivite</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Durum</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Başlangıç</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Süre</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PEAK CPU</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PEAK MEM</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.taskLogs?.length > 0 ? data.taskLogs.map((t, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900 dark:text-white">{t.TASK_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{t.ACTIVITY || '-'}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.STATUS === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      t.STATUS === 'FAILED' || t.STATUS === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>{t.STATUS}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{t.START_TIME ? new Date(t.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-gray-500 dark:text-gray-400">{t.DURATION_SEC ? `${t.DURATION_SEC}s` : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-mono text-gray-700 dark:text-gray-300">{t.PEAK_CPU || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-mono text-gray-700 dark:text-gray-300">{t.PEAK_MEMORY || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">Görev kaydı yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={650}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-500" />Zamanlanmış Görevler
            </h3>
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_SCHEDULES_V_EXT</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Görev</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Schedule</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sahip</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aktif</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sonraki Çalışma</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.taskSchedules?.length > 0 ? data.taskSchedules.map((s, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900 dark:text-white">{s.TASK_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono">{s.SCHEDULE_STRING || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{s.OWNER || '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.IS_ENABLED ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>{s.IS_ENABLED ? 'Aktif' : 'Pasif'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{s.NEXT_RUN_TIME ? new Date(s.NEXT_RUN_TIME).toLocaleString('tr-TR') : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">Zamanlanmış görev yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={700}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />Hata Alan Görevler
            </h3>
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_LOG_MESSAGES_V_EXT</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Görev</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Object ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tarih</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hata Mesajı</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.taskErrors?.length > 0 ? data.taskErrors.map((e, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900 dark:text-white">{e.TASK_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{e.OBJECT_ID || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{e.START_TIME ? new Date(e.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-red-600 dark:text-red-400 max-w-xs truncate" title={e.TEXT}>{e.TEXT || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">Hata kaydı yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={750}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-500" />Kilitli Çalışan Görevler
            </h3>
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_LOCKS_V_EXT</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Görev</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Object ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kilit Durumu</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kullanıcı</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Başlangıç</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.taskLocks?.length > 0 ? data.taskLocks.map((l, i) => (
                <tr key={i} className="conn-row" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900 dark:text-white">{l.TASK_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{l.OBJECT_ID || '-'}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.LOCK_STATUS === 'LOCKED' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>{l.LOCK_STATUS || '-'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{l.USER_NAME || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{l.START_TIME ? new Date(l.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">Kilitli görev yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>
    </div>
  );
};

export default HealthMonitor;
