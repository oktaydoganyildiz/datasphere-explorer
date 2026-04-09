import React, { useState, useEffect, useCallback } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity, Cpu, HardDrive, Database, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, AlertCircle, Play, Calendar } from 'lucide-react';
import { FadeScaleIn, SlideUpIn } from './PageTransition';
import { StatCardSkeleton } from './Skeleton';

const healthStyles = `
@keyframes spin-slow { to { transform: rotate(360deg); } }
.spin-slow { animation: spin-slow 2s linear infinite; }
.conn-row { transition: background .15s ease; }
.conn-row:hover { background: rgba(255,255,255,0.02); }
.refresh-btn { transition: transform .2s ease, box-shadow .2s ease; }
.refresh-btn:hover { transform: rotate(45deg); box-shadow: 0 0 12px rgba(96,165,250,0.2); }
.metric-card { transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
.metric-card:hover { transform: translateY(-2px); box-shadow: 0 0 24px -4px rgba(96,165,250,0.15); }
@keyframes staggerChild { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
:root { --color-background-secondary: rgba(255,255,255,0.03); --color-text-primary: #fff; }
`;

if (!document.querySelector('#health-monitor-styles')) {
  const s = document.createElement('style');
  s.id = 'health-monitor-styles';
  s.textContent = healthStyles;
  document.head.appendChild(s);
}

const getColor = (pct) => {
  if (pct >= 90) return '#f87171';
  if (pct >= 75) return '#fbbf24';
  return '#34d399';
};

const getStatus = (pct) => {
  if (pct >= 90) return { label: 'Kritik', cls: 'text-red-400' };
  if (pct >= 75) return { label: 'Yüksek', cls: 'text-amber-400' };
  return { label: 'Normal', cls: 'text-emerald-400' };
};

const getGlow = (pct) => {
  if (pct >= 90) return 'shadow-[0_0_20px_rgba(248,113,113,0.15)]';
  if (pct >= 75) return 'shadow-[0_0_20px_rgba(251,191,36,0.15)]';
  return 'shadow-[0_0_20px_rgba(52,211,153,0.1)]';
};

const GaugeCard = ({ title, pct, icon: Icon, usedGb, totalGb, delay = 0 }) => {
  const color = getColor(pct);
  const status = getStatus(pct);
  const glow = getGlow(pct);
  return (
    <FadeScaleIn delay={delay}>
      <div className={`metric-card bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5 flex flex-col items-center ${glow}`}>
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div style={{ width: 130, height: 130, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius={42} outerRadius={60} startAngle={220} endAngle={-40} data={[{ value: Math.max(pct, 2) }]} barSize={14}>
              <RadialBar background={{ fill: 'rgba(255,255,255,0.04)' }} dataKey="value" cornerRadius={7} fill={color} animationDuration={1200} animationEasing="ease-out" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: '#fff' }}>{pct.toFixed(0)}%</span>
          </div>
        </div>
        <span className={`text-xs font-medium mt-1 ${status.cls}`}>{status.label}</span>
        {usedGb !== undefined && totalGb > 0 && (
          <p className="text-xs text-slate-500 mt-1">{usedGb.toFixed(1)} / {totalGb.toFixed(1)} GB</p>
        )}
      </div>
    </FadeScaleIn>
  );
};

const REFRESH_INTERVAL = 30000;

const StatusBadge = ({ status }) => {
  const cls = status === 'COMPLETED'
    ? 'bg-emerald-500/10 text-emerald-400'
    : status === 'FAILED'
      ? 'bg-red-500/10 text-red-400'
      : 'bg-amber-500/10 text-amber-400';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
};

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
          taskLogs: dsTasksJson.taskLogs || [],
          taskErrors: dsTasksJson.taskErrors || [],
          taskChains: dsTasksJson.taskChains || [],
          taskStats: dsTasksJson.taskStats || [],
          appStats: dsTasksJson.appStats || [],
          spaces: dsTasksJson.spaces || [],
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
            <h2 className="text-2xl font-bold text-white">Health Monitor</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {lastUpdated ? `Son güncelleme: ${lastUpdated.toLocaleTimeString('tr-TR')} · ${countdown}s sonra yenilenir` : 'Yükleniyor…'}
              {isMock && <span className="ml-2 text-xs text-amber-400"> (örnek veri)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                allGood ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {allGood ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {allGood ? 'Tüm sistemler normal' : 'Dikkat gerekiyor'}
              </div>
            )}
            <button onClick={() => fetchHealth(true)} className="refresh-btn p-2 rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-400 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/[0.05] transition-colors">
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

      {/* DataSphere Summary Cards */}
      {!loading && data?.dsSummary && (
        <SlideUpIn delay={180}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-500">Başarılı (24s)</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{data.dsSummary.completed24h || 0}</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-500">Başarısız (24s)</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{data.dsSummary.failed24h || 0}</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-500">Toplam (24s)</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{data.dsSummary.total24h || 0}</p>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-500">Aktif Görev</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{data.dsSummary.activeTasks || 0}</p>
            </div>
          </div>
        </SlideUpIn>
      )}

      {isMock && !loading && (
        <SlideUpIn delay={200}>
          <div className="flex items-start gap-3 p-4 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-amber-300 mb-1">Sistem tablosu yetkisi gerekli</p>
              <p className="text-amber-400/80">
                Gerçek CPU/Bellek/Disk verisi için kullanıcınıza şu tablolara SELECT yetkisi verin:
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['SYS.M_LOAD_HISTORY_SERVICE', 'SYS.M_HOST_RESOURCE_UTILIZATION', 'SYS.M_DISK_USAGE', 'SYS.M_CONNECTIONS', 'SYS.M_EXPENSIVE_STATEMENTS'].map(t => (
                  <code key={t} className="px-1.5 py-0.5 bg-amber-500/10 rounded text-amber-300">{t}</code>
                ))}
              </div>
            </div>
          </div>
        </SlideUpIn>
      )}

      <SlideUpIn delay={300}>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.03] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />Task Chains
            </h3>
            <span className="text-xs text-slate-500">DWC_GLOBAL.TASK_CHAIN_RUNS (Detay için tıklayın)</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-white/[0.02]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Chain Adı</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Space</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Kullanıcı</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Başlangıç</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">Süre</th>
            </tr></thead>
            <tbody>
              {data?.taskChains?.length > 0 ? data.taskChains.map((c, i) => (
                <tr
                  key={i}
                  className="conn-row cursor-pointer border-b border-white/[0.03] hover:bg-white/[0.02]"
                  style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}
                  onClick={() => fetchChainDetail(c.CHAIN_TASK_LOG_ID)}
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-blue-400 underline">{c.TECHNICAL_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.SPACE_ID}</td>
                  <td className="px-4 py-2.5 text-xs"><StatusBadge status={c.STATUS} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.USER || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.START_TIME ? new Date(c.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-slate-400">{c.DURATION_SEC ? `${c.DURATION_SEC}s` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">Task Chain kaydı yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      <SlideUpIn delay={700}>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.03] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />Hata Alan Görevler
            </h3>
            <span className="text-xs text-slate-500">DWC_GLOBAL.TASK_LOG_MESSAGES</span>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="bg-white/[0.02]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Görev</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Object ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Hata Mesajı</th>
            </tr></thead>
            <tbody>
              {data?.taskErrors?.length > 0 ? data.taskErrors.map((e, i) => (
                <tr key={i} className="conn-row border-b border-white/[0.03] hover:bg-white/[0.02]" style={{ opacity: 0, animation: `staggerChild .3s ease ${i * 50}ms both` }}>
                  <td className="px-4 py-2.5 text-xs font-medium text-white">{e.TASK_NAME}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{e.OBJECT_ID || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{e.START_TIME ? new Date(e.START_TIME).toLocaleString('tr-TR') : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-red-400 max-w-xs truncate" title={e.TEXT}>{e.TEXT || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">Hata kaydı yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUpIn>

      {/* Task Chain Detail Modal */}
      {selectedChain && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div
            className="bg-[#0c1021]/95 backdrop-blur-2xl rounded-xl border border-white/[0.06] w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Task Chain Detayı
                {chainDetail?.chain && <StatusBadge status={chainDetail.chain.STATUS} />}
              </h3>
              <button onClick={closeDetail} className="p-1 hover:bg-white/[0.06] rounded transition-colors">
                <AlertCircle className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(80vh-60px)] p-5 space-y-5">
              {loadingDetail ? (
                <div className="text-center py-8"><div className="data-dots"><span></span><span></span><span></span></div></div>
              ) : chainDetail ? (
                <>
                  {chainDetail.chain && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Chain Adı</p>
                        <p className="font-medium text-white">{chainDetail.chain.TECHNICAL_NAME}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Space</p>
                        <p className="font-medium text-white">{chainDetail.chain.SPACE_ID}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Kullanıcı</p>
                        <p className="font-medium text-white">{chainDetail.chain.USER || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Süre</p>
                        <p className="font-medium text-white">{chainDetail.chain.DURATION_SEC}s</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Play className="w-4 h-4 text-blue-400" />Alt Görevler (Nodes)
                    </h4>
                    <table className="min-w-full text-sm border border-white/[0.06] rounded-lg overflow-hidden">
                      <thead><tr className="bg-white/[0.02]">
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Node</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Uygulama</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Object</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Aktivite</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Süre</th>
                      </tr></thead>
                      <tbody>
                        {chainDetail.nodes?.length > 0 ? chainDetail.nodes.map((n, i) => (
                          <tr key={i} className={`border-b border-white/[0.03] ${n.STATUS === 'FAILED' ? 'bg-red-500/[0.05]' : ''}`}>
                            <td className="px-3 py-2 text-xs font-mono text-slate-400">#{n.NODE_ID}</td>
                            <td className="px-3 py-2 text-xs text-slate-400">{n.APPLICATION_ID}</td>
                            <td className="px-3 py-2 text-xs font-medium text-white">{n.OBJECT_ID}</td>
                            <td className="px-3 py-2 text-xs text-slate-400">{n.ACTIVITY}</td>
                            <td className="px-3 py-2 text-xs"><StatusBadge status={n.STATUS} /></td>
                            <td className="px-3 py-2 text-xs text-right text-slate-400">{n.DURATION_SEC ? `${n.DURATION_SEC}s` : '-'}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Alt görev yok</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {chainDetail.errors?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />Hata Mesajları
                      </h4>
                      <div className="space-y-2">
                        {chainDetail.errors.map((e, i) => (
                          <div key={i} className="p-3 bg-red-500/[0.06] border border-red-500/15 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                e.SEVERITY === 'ERROR' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>{e.SEVERITY}</span>
                              <span className="text-xs text-slate-500">{e.TIMESTAMP ? new Date(e.TIMESTAMP).toLocaleString('tr-TR') : ''}</span>
                              <span className="text-xs text-slate-500">Task #{e.TASK_LOG_ID}</span>
                            </div>
                            <p className="text-sm text-red-300">{e.TEXT}</p>
                            {e.DETAILS && (
                              <details className="mt-2">
                                <summary className="text-xs text-slate-500 cursor-pointer">Detaylar</summary>
                                <pre className="mt-1 text-xs bg-white/[0.02] p-2 rounded overflow-x-auto text-slate-400">{e.DETAILS}</pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">Detay bulunamadı</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthMonitor;
