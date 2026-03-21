import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Database, Table, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

// --- Components ---

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const ChartContainer = ({ title, children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col h-[400px] ${className}`}>
    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">{title}</h3>
    <div className="flex-1 w-full min-h-0">
      {children}
    </div>
  </div>
);

const StorageProgressBar = ({ percentage }) => {
  let colorClass = "bg-blue-600";
  if (percentage > 95) colorClass = "bg-red-500";
  else if (percentage > 80) colorClass = "bg-yellow-500";

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">HANA Cloud Storage</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{percentage}% Used</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full transition-all duration-1000 ${colorClass}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const DataLoadStatusList = ({ loads }) => (
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
            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
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
                  {load.status === 'success' ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  {load.status === 'success' ? 'Success' : 'Failed'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Mock Data ---

const MOCK_TOP_TABLES = [
  { name: 'SALES_DATA', rows: 1250000 },
  { name: 'LOGS_2023', rows: 850000 },
  { name: 'CUSTOMER_DIM', rows: 450000 },
  { name: 'PRODUCT_MD', rows: 120000 },
  { name: 'INVOICES', rows: 95000 }
];

const MOCK_OBJECT_DISTRIBUTION = [
  { name: 'Local Tables', value: 45 },
  { name: 'Remote Tables', value: 12 },
  { name: 'Views', value: 28 },
  { name: 'Data Flows', value: 8 }
];

const MOCK_DATA_LOADS = [
  { task: 'Daily Sales Import', time: '10:30 AM', status: 'success' },
  { task: 'Inventory Sync', time: '09:15 AM', status: 'success' },
  { task: 'Customer CRM Update', time: '08:45 AM', status: 'failed' },
  { task: 'Logs Archiving', time: '02:00 AM', status: 'success' },
  { task: 'Currency Rates Fetch', time: '01:30 AM', status: 'success' }
];

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

const Dashboard = () => {
  const { connectionConfig } = useConnectionStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats/dashboard');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to load stats", err);
        setStats({
          totalTables: 0,
          totalViews: 0,
          schema: 'UNKNOWN',
          topTables: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) return null;

  const formatYAxis = (tickItem) => {
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}K`;
    return tickItem;
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Operational Insights</h2>
        
        {/* Remote Connections Badge */}
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {stats.activeConnections !== undefined ? stats.activeConnections : '-'} Remote Connections Active
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Tables" 
          value={stats.totalTables} 
          icon={Table} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Total Views" 
          value={stats.totalViews} 
          icon={Eye} 
          color="bg-purple-500" 
        />
        <StatCard 
          title="Current Schema" 
          value={stats.schema} 
          icon={Database} 
          color="bg-emerald-500" 
        />
      </div>

      {/* Storage Progress Bar */}
      <StorageProgressBar percentage={82} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Largest Tables (Bar Chart) */}
        <ChartContainer title="Largest Tables (Rows)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={MOCK_TOP_TABLES} 
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatYAxis} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px', 
                  color: '#fff',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: '#fff' }}
                formatter={(value) => new Intl.NumberFormat('en-US').format(value)}
              />
              <Bar 
                dataKey="rows" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]} 
                barSize={40}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* 2. Object Distribution (Donut Chart) */}
        <ChartContainer title="Object Distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={MOCK_OBJECT_DISTRIBUTION}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {MOCK_OBJECT_DISTRIBUTION.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px', 
                  color: '#fff' 
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

      </div>

      {/* Data Load Status List */}
      <DataLoadStatusList loads={MOCK_DATA_LOADS} />
    </div>
  );
};

export default Dashboard;
