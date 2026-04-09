import React, { useState, useEffect, useCallback } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity, Cpu, HardDrive, Database, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, AlertCircle, Play, Calendar } from 'lucide-react';
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
  const [selectedChain, setSelectedChain] = useState(null);
  const [chainDetail, setChainDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Fetch Task Chain detail
  const fetchChainDetail = async (chainLogId) => {
    setLoadingDetail(true);
    setSelectedChain(chainLogId);
    try {
      const res = await fetch(`/api/stats/datasphere/taskchain/${chainLogId}`);
      const json = await res.json();
      setChainDetail(json);
    } catch (err) {
      console.error('Failed to fetch chain detail:', err);
      setChainDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedChain(null);
    setChainDetail(null);
  };

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      // Fetch both standard health and DataSphere-specific data in parallel
      const [healthRes, dsTasksRes, dsOverviewRes] = await Promise.all([
        fetch('/api/stats/health'),
        fetch('/api/stats/datasphere/tasks'),
        fetch('/api/stats/datasphere/overview'),
      ]);

      const [healthJson, dsTasksJson, dsOverviewJson] = await Promise.all([
        healthRes.json(),
        dsTasksRes.ok ? dsTasksRes.json() : {},
        dsOverviewRes.ok ? dsOverviewRes.json() : {},
      ]);

      const hasReal = healthJson.cpu?.pct > 0 || healthJson.mem?.pct > 0 || healthJson.disk?.pct > 0;
      const hasDataSphereData = dsTasksJson.taskLogs?.length > 0 || dsTasksJson.taskChains?.length > 0;

      if (hasReal || hasDataSphereData) {
        setData({
          ...healthJson,
          // DataSphere task monitoring data
          taskLogs: dsTasksJson.taskLogs || [],
          taskErrors: dsTasksJson.taskErrors || [],
          taskChains: dsTasksJson.taskChains || [],
          taskStats: dsTasksJson.taskStats || [],
          appStats: dsTasksJson.appStats || [],
          spaces: dsTasksJson.spaces || [],
          // Overview metrics
          dsSummary: dsOverviewJson.summary || {},
          hourlyTrend: dsOverviewJson.hourlyTrend || [],
          avgDuration: dsOverviewJson.avgDuration || [],
        });
        setIsMock(!hasReal && hasDataSphereData);
      } else {
        setData({ ...MOCK, connections: healthJson.connections || [], expensiveStatements: healthJson.expensiveStatements || [] });
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

      {/* DataSphere Özet Kartları */}
      {!loading && data?.dsSummary && (
        <SlideUpIn delay={180}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Başarılı (24s)</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.dsSummary.completed24h || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Başarısız (24s)</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.dsSummary.failed24h || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Toplam (24s)</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.dsSummary.total24h || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Aktif Görev</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.dsSummary.activeTasks || 0}</p>
            </div>
          </div>
        </SlideUpIn>
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
              <Calendar className="w-4 h-4 text-purple-500" />Task Chains
            </h3>
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_CHAIN_RUNS (Detay için tıklayın)</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chain Adı</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Space</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Durum</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kullanıcı</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Başlangıç</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Süre</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data?.taskChains?.length > 0 ? data.taskChains.map((c, i) => (
                <tr 
                  key={i} 
                  className="conn-row cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" 
                  style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}
                  onClick={() => fetchChainDetail(c.CHAIN_TASK_LOG_ID)}
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 underline">{c.TECHNICAL_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{c.SPACE_ID}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.STATUS === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      c.STATUS === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>{c.STATUS}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{c.USER || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{c.START_TIME ? new Date(c.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-gray-500 dark:text-gray-400">{c.DURATION_SEC ? `${c.DURATION_SEC}s` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">Task Chain kaydı yok</td></tr>
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
            <span className="text-xs text-gray-400">DWC_GLOBAL.TASK_LOG_MESSAGES</span>
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

      {/* Task Chain Detail Modal */}
      {selectedChain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div 
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Task Chain Detayı
                {chainDetail?.chain && (
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    chainDetail.chain.STATUS === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    chainDetail.chain.STATUS === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>{chainDetail.chain.STATUS}</span>
                )}
              </h3>
              <button onClick={closeDetail} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                <AlertCircle className="w-5 h-5 text-gray-400 rotate-45" />
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(80vh-60px)] p-5 space-y-5">
              {loadingDetail ? (
                <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
              ) : chainDetail ? (
                <>
                  {/* Chain Info */}
                  {chainDetail.chain && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Chain Adı</p>
                        <p className="font-medium text-gray-900 dark:text-white">{chainDetail.chain.TECHNICAL_NAME}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Space</p>
                        <p className="font-medium text-gray-900 dark:text-white">{chainDetail.chain.SPACE_ID}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Kullanıcı</p>
                        <p className="font-medium text-gray-900 dark:text-white">{chainDetail.chain.USER || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Süre</p>
                        <p className="font-medium text-gray-900 dark:text-white">{chainDetail.chain.DURATION_SEC}s</p>
                      </div>
                    </div>
                  )}

                  {/* Sub-Tasks (Nodes) */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Play className="w-4 h-4 text-blue-500" />Alt Görevler (Nodes)
                    </h4>
                    <table className="min-w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <thead><tr className="bg-gray-50 dark:bg-slate-900/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Node</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uygulama</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Object</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aktivite</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Süre</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {chainDetail.nodes?.length > 0 ? chainDetail.nodes.map((n, i) => (
                          <tr key={i} className={n.STATUS === 'FAILED' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                            <td className="px-3 py-2 text-xs font-mono">#{n.NODE_ID}</td>
                            <td className="px-3 py-2 text-xs">{n.APPLICATION_ID}</td>
                            <td className="px-3 py-2 text-xs font-medium">{n.OBJECT_ID}</td>
                            <td className="px-3 py-2 text-xs">{n.ACTIVITY}</td>
                            <td className="px-3 py-2 text-xs">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                n.STATUS === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                n.STATUS === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>{n.STATUS}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-right">{n.DURATION_SEC ? `${n.DURATION_SEC}s` : '-'}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">Alt görev yok</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Error Messages */}
                  {chainDetail.errors?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />Hata Mesajları
                      </h4>
                      <div className="space-y-2">
                        {chainDetail.errors.map((e, i) => (
                          <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                e.SEVERITY === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>{e.SEVERITY}</span>
                              <span className="text-xs text-gray-500">{e.TIMESTAMP ? new Date(e.TIMESTAMP).toLocaleString('tr-TR') : ''}</span>
                              <span className="text-xs text-gray-400">Task #{e.TASK_LOG_ID}</span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300">{e.TEXT}</p>
                            {e.DETAILS && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer">Detaylar</summary>
                                <pre className="mt-1 text-xs bg-gray-100 dark:bg-slate-900 p-2 rounded overflow-x-auto">{e.DETAILS}</pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">Detay bulunamadı</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthMonitor;
