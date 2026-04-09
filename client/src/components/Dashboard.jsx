import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Database, Table, Eye, CheckCircle, XCircle, Clock, TrendingUp, Activity } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import useAnimatedCounter from '../hooks/useAnimatedCounter';
import { DashboardSkeleton } from './Skeleton';
import { FadeScaleIn, SlideUpIn } from './PageTransition';

const pulseStyles = `
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
@keyframes bar-grow {
  from { transform: scaleY(0); transform-origin: bottom; }
  to   { transform: scaleY(1); transform-origin: bottom; }
}
@keyframes card-hover-lift {
  from { transform: translateY(0); box-shadow: none; }
  to   { transform: translateY(-2px); }
}
@keyframes status-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.stat-card-animated {
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease;
}
.stat-card-animated:hover {
  transform: translateY(-3px);
  box-shadow: 0 0 24px -4px rgba(96, 165, 250, 0.15), 0 0 48px -8px rgba(139, 92, 246, 0.1);
}
.progress-bar-fill {
  transition: width 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.progress-glow {
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.4), 0 0 16px rgba(96, 165, 250, 0.2);
}
.progress-glow-yellow {
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.4), 0 0 16px rgba(234, 179, 8, 0.2);
}
.progress-glow-red {
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4), 0 0 16px rgba(239, 68, 68, 0.2);
}
.status-dot-animated {
  animation: pulse-dot 2s ease-in-out infinite;
}
.row-hover {
  transition: background 0.15s ease;
}
`;

if (!document.querySelector('#dashboard-anim-styles')) {
  const style = document.createElement('style');
  style.id = 'dashboard-anim-styles';
  style.textContent = pulseStyles;
  document.head.appendChild(style);
}

const AnimatedStatCard = ({ title, value, icon: Icon, color, delay = 0, prefix = '', suffix = '' }) => {
  const isNumber = typeof value === 'number';
  const animatedValue = useAnimatedCounter(isNumber ? value : 0, 1400, delay + 200);

  return (
    <FadeScaleIn delay={delay}>
      <div className="stat-card-animated bg-white/[0.03] backdrop-blur-xl p-6 rounded-lg border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              {prefix}{isNumber ? animatedValue.toLocaleString() : value}{suffix}
            </p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    </FadeScaleIn>
  );
};

const AnimatedProgressBar = ({ percentage }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(percentage), 400);
    return () => clearTimeout(timer);
  }, [percentage]);

  let colorClass = 'bg-blue-500 progress-glow';
  if (percentage > 95) colorClass = 'bg-red-500 progress-glow-red';
  else if (percentage > 80) colorClass = 'bg-yellow-500 progress-glow-yellow';

  return (
    <SlideUpIn delay={600}>
      <div className="mb-6 bg-white/[0.03] backdrop-blur-xl p-4 rounded-lg border border-white/[0.06]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-300">
            HANA Cloud Storage
          </span>
          <span className="text-sm font-bold text-white">
            {percentage}% Used
          </span>
        </div>
        <div className="w-full bg-white/[0.05] rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full progress-bar-fill ${colorClass}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </SlideUpIn>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/20 rounded-lg px-3 py-2 shadow-xl text-xs text-white">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {new Intl.NumberFormat('en-US').format(p.value)} rows
        </p>
      ))}
    </div>
  );
};

const AnimatedDataLoads = ({ loads }) => (
  <SlideUpIn delay={800}>
    <div className="bg-white/[0.03] backdrop-blur-xl p-6 rounded-lg border border-white/[0.06]">
      <h3 className="text-lg font-bold text-white mb-4">Recent Data Loads</h3>
      {loads?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 rounded-l-md">Task Name</th>
                <th className="px-4 py-3">Object ID</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Triggered By</th>
                <th className="px-4 py-3 rounded-r-md text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loads.map((load, index) => {
                const isSuccess = load.status === 'success';
                const isFailed = load.status === 'failed';
                const isRunning = load.status === 'running';
                const statusCls = isSuccess
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : isFailed
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-400';

                const IconEl = isSuccess
                  ? CheckCircle
                  : isFailed
                    ? XCircle
                    : Activity;

                const label = isSuccess ? 'Success' : isFailed ? 'Failed' : 'Running';

                return (
                  <tr
                    key={index}
                    className="row-hover hover:bg-white/[0.02]"
                    style={{
                      opacity: 0,
                      animation: `staggerChild 0.4s cubic-bezier(0.16,1,0.3,1) ${800 + index * 80}ms both`,
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-white">{load.task}</td>
                    <td className="px-4 py-3 text-slate-400">{load.objectId}</td>
                    <td className="px-4 py-3 text-slate-400">{load.activity}</td>
                    <td className="px-4 py-3 text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1.5" />
                      {load.time}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{load.duration}</td>
                    <td className="px-4 py-3 text-slate-400">{load.triggeredBy}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                        <IconEl className="w-3 h-3 mr-1" />
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-slate-400">
          No recent data load records found.
        </div>
      )}
    </div>
  </SlideUpIn>
);

const COLORS = ['#60a5fa', '#10b981', '#8b5cf6', '#22d3ee'];

const Dashboard = () => {
  const { selectedSchema, schemas, setSelectedSchema } = useConnectionStore();
  const [stats, setStats] = useState(null);
  const [recentDataLoads, setRecentDataLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const activeConns = useAnimatedCounter(stats?.activeConnections ?? 0, 1000, 600);

  const schemaOptions = ['SYS', ...(schemas || [])].filter(Boolean);
  const currentSchema = selectedSchema || schemaOptions[0] || 'SYS';

  const topTablesData = (stats?.topTables || [])
    .map(t => ({
      name: t.TABLE_NAME || t.name,
      rows: typeof t.RECORD_COUNT === 'number' ? t.RECORD_COUNT : parseInt(t.RECORD_COUNT || 0, 10),
    }))
    .filter(t => t.name);

  const objectDistributionData = [
    { name: 'Tables', value: stats?.totalTables || 0 },
    { name: 'Views', value: stats?.totalViews || 0 },
  ].filter(x => x.value > 0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/stats/dashboard?schema=${encodeURIComponent(currentSchema)}`);
        const data = await res.json();
        console.log('Dashboard stats:', data);
        setStats(data);
        if (!initialLoadDone) {
          setRecentDataLoads(data.recentDataLoads || []);
          setInitialLoadDone(true);
        }
      } catch {
        setStats({ totalTables: 0, totalViews: 0, schema: 'UNKNOWN', topTables: [], activeConnections: 0, recentDataLoads: [], storage: { pct: 0, usedGb: 0, totalGb: 0 } });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [currentSchema]);

  const formatYAxis = (v) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return v;
  };

  if (loading) return <DashboardSkeleton />;
  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <FadeScaleIn delay={0}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Operational Insights</h2>
            <p className="text-sm text-slate-400 mt-0.5">Real-time system overview</p>
          </div>
          <div className="flex items-center space-x-2 bg-white/[0.03] backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/[0.06]">
            <div className="status-dot-animated w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span className="text-xs font-semibold text-slate-300">
              {activeConns} Remote Connections Active
            </span>
          </div>
        </div>
      </FadeScaleIn>

      {/* KPI cards with staggered entrance */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Schema</div>
          <select
            className="p-2 border border-white/[0.06] rounded-md text-sm bg-white/[0.03] text-white transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            value={currentSchema}
            onChange={(e) => setSelectedSchema(e.target.value)}
            aria-label="Schema select"
          >
            {schemaOptions.map(s => (
              <option key={s} value={s} className="bg-slate-900 text-white">
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatedStatCard title="Total Tables"   value={stats.totalTables} icon={Table}    color="bg-blue-500/10 text-blue-400"    delay={0} />
        <AnimatedStatCard title="Total Views"    value={stats.totalViews}  icon={Eye}      color="bg-purple-500/10 text-purple-400"  delay={100} />
        <AnimatedStatCard title="Current Schema" value={stats.schema}      icon={Database} color="bg-emerald-500/10 text-emerald-400" delay={200} />
      </div>

      {/* Storage bar */}
      <AnimatedProgressBar percentage={stats.storage?.pct ?? 0} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SlideUpIn delay={400}>
          <div className="bg-white/[0.03] backdrop-blur-xl p-6 rounded-lg border border-white/[0.06] flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-white mb-6">Largest Tables (Rows)</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTablesData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(96,165,250,0.06)' }} />
                  <Bar dataKey="rows" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1200} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideUpIn>

        <SlideUpIn delay={500}>
          <div className="bg-white/[0.03] backdrop-blur-xl p-6 rounded-lg border border-white/[0.06] flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-white mb-6">Object Distribution</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={objectDistributionData}
                    cx="50%" cy="50%"
                    innerRadius={80} outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={400}
                    animationDuration={1000}
                  >
                    {objectDistributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(34,211,238,0.2)',
                      borderRadius: '8px', color: '#fff', backdropFilter: 'blur(12px)',
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideUpIn>
      </div>

      {/* Data loads table */}
      <AnimatedDataLoads loads={recentDataLoads} />
    </div>
  );
};

export default Dashboard;
