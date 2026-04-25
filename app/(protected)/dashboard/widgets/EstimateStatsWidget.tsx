'use client';

import { useDashboard } from '@/lib/hooks/api/useDashboard';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface EstimateStats {
    status: string;
    count: number;
    total: number;
}

const PieChart = ({ data }: { data: EstimateStats[] }) => {
    const total = data.reduce((sum, d) => sum + d.total, 0);
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    
    let startAngle = 0;
    const paths = data.map((d, i) => {
        const angle = total === 0 ? 0 : (d.total / total) * 360;
        const endAngle = startAngle + angle;
        
        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        const pathD = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
        startAngle = endAngle;
        
        return <path key={i} d={pathD} fill={colors[i % colors.length]} className="hover:opacity-80 transition-opacity" />;
    });

    return (
        <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" className="w-32 h-32">
                {paths}
                <circle cx="50" cy="50" r="20" fill="white" />
            </svg>
            <div className="space-y-1">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-slate-600 capitalize">{d.status}</span>
                        <span className="font-semibold text-slate-900 ml-auto">${Math.round(d.total).toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export function EstimateStatsWidget({ week, scope, initialData, isHidden }: { week: string, scope: 'self'|'all', initialData?: any, isHidden?: boolean }) {
    const [estimateFilter, setEstimateFilter] = useState('all');
    const { data } = useDashboard(week, scope, 'stats', initialData, estimateFilter);
    const estimateStats = data?.estimateStats ?? [];

    if (isHidden) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-4 justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">Estimates Overview</h2>
                    </div>
                </div>
                
                <div className="relative">
                    <select 
                        value={estimateFilter}
                        onChange={(e) => setEstimateFilter(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-purple-100 cursor-pointer"
                    >
                        <option value="all">All Time</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="ytd">Year to Date</option>
                        <option value="last_year">Last Year</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
            </div>
            {estimateStats.length > 0 ? (
                <PieChart data={estimateStats} />
            ) : (
                <div className="h-32 flex items-center justify-center">
                    <p className="text-slate-400">No data available</p>
                </div>
            )}
        </div>
    );
}
