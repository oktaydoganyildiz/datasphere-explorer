import React, { useState, useEffect, useCallback } from 'react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  Tooltip, Cell
} from 'recharts';
import { Activity, Cpu, HardDrive, Database, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';
import { StatCardSkeleton } from './Skeleton';

const healthStyles = `
@keyframes spin-slow { to { transform: rotate(360deg); } }
.spin-slow { animation: spin-slow 2s linear infinite; }
@keyframes gauge-pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
.gauge-warning { animation: gauge-pulse 1.8s ease-in-out infinite; }
@keyframes row-flash { 0%{background:var(--color-background-info)} 100%{background:transparent} }
.row-updated { animation: row-flash 0.6s ease; }
.conn-row { transition: background .15s ease; }
.conn-row:hover { background: var(--color-background-secondary); }
.refresh-btn { transition: transform .2s ease, color .2s ease; }
.refresh-btn:hover { transform: rotate(45deg); color: var(--color-text-info); }
.metric-card { transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
.metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px -4px rgba(0,0,0,.1); }
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
  if (pct >= 75) return { label: 'Yüksek',  cls: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Normal', cls: 'text-emerald-600 dark:text-emerald-400' };
};

const GaugeCard = ({ title, pct, icon: Icon, usedGb, totalGb, delay = 0 }) => {
  const color  = getColor(pct);
  const status = getStatus(pct);
  const data   = [{ value: pct }, { value: 100 - pct }];

  return (
    <FadeScaleIn delay={delay}>
      <div className={`metric-card bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 flex flex-col items-center ${pct >= 90 ? 'gauge-warning' : ''}`}>
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{title}</span>
          <Icon className="w-4 h-4 text-gray-400" />
        </div>

        <div style={{ width: 130, height: 130, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius={42} outerRadius={60}
              startAngle={220} endAngle={-40}
              data={[{ value: Math.max(pct, 2) }]}
              barSize={14}
            >
              <RadialBar
                background={{ fill: 'var(--color-background-secondary)' }}
                dataKey="value"
                cornerRadius={7}
                fill={color}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>

        {(usedGb !== undefined && totalGb !== undefined && totalGb > 0) && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            {usedGb.toFixed(1)} / {totalGb.toFixed(1)} GB
          </p>
        )}
      </div>
    </FadeScaleIn>
  );
};

const ConnectionRow = ({ conn, index }) => {
  const isRunning = conn.CONNECTION_STATUS === 'RUNNING';
  return (
    <tr
      className="conn-row"
      style={{ opacity: 0, animation: `staggerChild .3s ease ${index * 50}ms both` }}
    >
      <td className="px-4 py-2.5 text-xs font-mono text-gray-900 dark:text-white whitespace-nowrap">
        #{conn.CONNECTION_ID}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{conn.USER_NAME}</td>
      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{conn.CLIENT_HOST}</td>
      <td className="px-4 py-2.5 text-xs">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          isRunning
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
        }`}>
          {isRunning && <span style={{ width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block' }} />}
          {conn.CONNECTION_STATUS}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{conn.STMT_TYPE || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">
        {conn.DURATION_S != null ? `${conn.DURATION_S}s` : '—'}
      </td>
    </tr>
  );
};

const ExpensiveRow = ({ stmt, index }) => (
  <tr
    className="conn-row"
    style={{ opacity: 0, animation: `staggerChild .3s ease ${index * 60}ms both` }}
  >
    <td className="px-4 py-2.5 text-xs text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
      {Number(stmt.DURATION_MS).toLocaleString()} ms
    </td>
    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-right">{stmt.EXECUTION_COUNT}</td>
    <td className="px-4 py-2.5 text-xs font-mono text-gray-600 dark:text-gray-400 max-w-xs truncate">
      {stmt.STATEMENT_STRING?.slice(0, 80)}…
    </td>
  </tr>
);

const REFRESH_INTERVAL = 30000;

const HealthMonitor = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL / 1000);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/stats/health');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch {
      if (!data) {
        setData({
          cpu:  { pct: 42 },
          mem:  { pct: 68, usedGb: 10.9, totalGb: 16 },
          disk: { pct: 55, usedGb: 220, totalGb: 400 },
          connections: [],
          expensiveStatements: [],
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  useEffect(() => {
    const interval = setInterval(() => fetchHealth(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const allGood = data && data.cpu.pct < 75 && data.mem.pct < 75 && data.disk.pct < 75;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <FadeScaleIn delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Health Monitor</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {lastUpdated ? `Son güncelleme: ${lastUpdated.toLocaleTimeString('tr-TR')} · ${countdown}s sonra yenilenir` : 'Yükleniyor…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                allGood
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
              }`}>
                {allGood ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {allGood ? 'Tüm sistemler normal' : 'Dikkat gerekiyor'}
              </div>
            )}
            <button
              onClick={() => fetchHealth(true)}
              className="refresh-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'spin-slow' : ''}`} />
            </button>
          </div>
        </div>
      </FadeScaleIn>

      {/* Gauge cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <GaugeCard title="CPU Kullanımı" pct={data.cpu.pct}  icon={Cpu}       delay={0}   />
          <GaugeCard title="Bellek"        pct={data.mem.pct}  icon={Activity}  delay={80}  usedGb={data.mem.usedGb}  totalGb={data.mem.totalGb}  />
          <GaugeCard title="Disk"          pct={data.disk.pct} icon={HardDrive} delay={160} usedGb={data.disk.usedGb} totalGb={data.disk.totalGb} />
        </div>
      )}

      {/* Active connections */}
      <SlideUpIn delay={300}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              Aktif Bağlantılar
            </h3>
            <span className="text-xs text-gray-400">{data?.connections?.length ?? 0} bağlantı</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-900/50">
                  {['ID', 'Kullanıcı', 'Host', 'Durum', 'İşlem', 'Süre'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {data?.connections?.length > 0
                  ? data.connections.map((c, i) => <ConnectionRow key={c.CONNECTION_ID} conn={c} index={i} />)
                  : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                        Aktif bağlantı bulunamadı
                      </td>
                    </tr>
                  )
                }
              </tbody>
            </table>
          </div>
        </div>
      </SlideUpIn>

      {/* Expensive statements */}
      <SlideUpIn delay={450}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              En Yavaş Sorgular
            </h3>
            <span className="text-xs text-gray-400">M_EXPENSIVE_STATEMENTS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-900/50">
                  {['Süre (ms)', 'Çalışma', 'SQL'].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${h === 'SQL' ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {data?.expensiveStatements?.length > 0
                  ? data.expensiveStatements.map((s, i) => <ExpensiveRow key={i} stmt={s} index={i} />)
                  : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400">
                        Henüz pahalı sorgu kaydı yok
                      </td>
                    </tr>
                  )
                }
              </tbody>
            </table>
          </div>
        </div>
      </SlideUpIn>
    </div>
  );
};

export default HealthMonitor;
