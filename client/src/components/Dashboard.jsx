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
  box-shadow: 0 8px 24px -6px rgba(0,0,0,0.12);
}
.progress-bar-fill {
  transition: width 1.2s cubic-bezier(0.16, 1, 0.3, 1);
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
      <div className="stat-card-animated bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {prefix}{isNumber ? animatedValue.toLocaleString() : value}{suffix}
            </p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
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

  let colorClass = 'bg-blue-600';
  if (percentage > 95) colorClass = 'bg-red-500';
  else if (percentage > 80) colorClass = 'bg-yellow-500';

  return (
    <SlideUpIn delay={600}>
      <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            HANA Cloud Storage
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {percentage}% Used
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
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
    <div className="bg-slate-900 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs text-white">
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
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Recent Data Loads</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 rounded-l-md">Task Name</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 rounded-r-md text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {loads.map((load, index) => (
              <tr
                key={index}
                className="row-hover hover:bg-gray-50 dark:hover:bg-slate-700/30"
                style={{
                  opacity: 0,
                  animation: `staggerChild 0.4s cubic-bezier(0.16,1,0.3,1) ${800 + index * 80}ms both`,
                }}
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{load.task}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1.5" />
                  {load.time}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    load.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {load.status === 'success'
                      ? <CheckCircle className="w-3 h-3 mr-1" />
                      : <XCircle className="w-3 h-3 mr-1" />
                    }
                    {load.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </SlideUpIn>
);

const MOCK_TOP_TABLES = [
  { name: 'SALES_DATA', rows: 1250000 },
  { name: 'LOGS_2023', rows: 850000 },
  { name: 'CUSTOMER_DIM', rows: 450000 },
  { name: 'PRODUCT_MD', rows: 120000 },
  { name: 'INVOICES', rows: 95000 },
];

const MOCK_OBJECT_DISTRIBUTION = [
  { name: 'Local Tables', value: 45 },
  { name: 'Remote Tables', value: 12 },
  { name: 'Views', value: 28 },
  { name: 'Data Flows', value: 8 },
];

const MOCK_DATA_LOADS = [
  { task: 'Daily Sales Import', time: '10:30 AM', status: 'success' },
  { task: 'Inventory Sync', time: '09:15 AM', status: 'success' },
  { task: 'Customer CRM Update', time: '08:45 AM', status: 'failed' },
  { task: 'Logs Archiving', time: '02:00 AM', status: 'success' },
  { task: 'Currency Rates Fetch', time: '01:30 AM', status: 'success' },
];

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeConns = useAnimatedCounter(stats?.activeConnections ?? 0, 1000, 600);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats/dashboard');
        const data = await res.json();
        setStats(data);
      } catch {
        setStats({ totalTables: 0, totalViews: 0, schema: 'UNKNOWN', topTables: [], activeConnections: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Operational Insights</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Real-time system overview</p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <div className="status-dot-animated w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {activeConns} Remote Connections Active
            </span>
          </div>
        </div>
      </FadeScaleIn>

      {/* KPI cards with staggered entrance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatedStatCard title="Total Tables"   value={stats.totalTables} icon={Table}    color="bg-blue-500"    delay={0} />
        <AnimatedStatCard title="Total Views"    value={stats.totalViews}  icon={Eye}      color="bg-purple-500"  delay={100} />
        <AnimatedStatCard title="Current Schema" value={stats.schema}      icon={Database} color="bg-emerald-500" delay={200} />
      </div>

      {/* Storage bar */}
      <AnimatedProgressBar percentage={82} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SlideUpIn delay={400}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Largest Tables (Rows)</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_TOP_TABLES} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                  <Bar dataKey="rows" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1200} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideUpIn>

        <SlideUpIn delay={500}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Object Distribution</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_OBJECT_DISTRIBUTION}
                    cx="50%" cy="50%"
                    innerRadius={80} outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={400}
                    animationDuration={1000}
                  >
                    {MOCK_OBJECT_DISTRIBUTION.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b', border: 'none',
                      borderRadius: '8px', color: '#fff',
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideUpIn>
      </div>

      {/* Data loads table */}
      <AnimatedDataLoads loads={MOCK_DATA_LOADS} />
    </div>
  );
};

export default Dashboard;
