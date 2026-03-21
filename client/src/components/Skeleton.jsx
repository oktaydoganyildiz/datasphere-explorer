import React from 'react';

const shimmer = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

if (!document.querySelector('#skeleton-styles')) {
  const style = document.createElement('style');
  style.id = 'skeleton-styles';
  style.textContent = shimmer;
  document.head.appendChild(style);
}

const SkeletonBase = ({ className = '', style = {}, rounded = false }) => (
  <div
    className={className}
    style={{
      background: 'linear-gradient(90deg, var(--sk-from) 25%, var(--sk-via) 50%, var(--sk-from) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
      borderRadius: rounded ? '9999px' : '6px',
      '--sk-from': 'var(--color-background-secondary)',
      '--sk-via': 'var(--color-border-tertiary)',
      ...style,
    }}
  />
);

export const SkeletonText = ({ width = '100%', height = 14 }) => (
  <SkeletonBase style={{ width, height: `${height}px`, display: 'block', marginBottom: '6px' }} />
);

export const SkeletonRect = ({ width = '100%', height = 44 }) => (
  <SkeletonBase style={{ width, height: `${height}px`, display: 'block' }} />
);

export const SkeletonCircle = ({ size = 40 }) => (
  <SkeletonBase rounded style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0 }} />
);

export const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div style={{ flex: 1 }}>
        <SkeletonText width="60%" height={12} />
        <div style={{ marginTop: 8 }}>
          <SkeletonText width="40%" height={28} />
        </div>
      </div>
      <SkeletonCircle size={48} />
    </div>
  </div>
);

export const TableRowSkeleton = ({ cols = 4 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <SkeletonText width={i === 0 ? '70%' : '50%'} />
      </td>
    ))}
  </tr>
);

export const ChartSkeleton = ({ height = 300 }) => (
  <div
    className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700"
    style={{ height: `${height + 80}px` }}
  >
    <SkeletonText width="40%" height={18} />
    <div style={{ marginTop: 24, display: 'flex', alignItems: 'flex-end', gap: 12, height: `${height}px` }}>
      {[65, 40, 80, 55, 70, 45, 90].map((h, i) => (
        <SkeletonRect
          key={i}
          width="100%"
          height={Math.floor((h / 100) * height)}
        />
      ))}
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="p-6 space-y-6">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
    <SkeletonRect height={12} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  </div>
);
