'use client';

import { useDashboard } from '@/lib/hooks/api/useDashboard';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EstimateStats {
    status: string;
    count: number;
    total: number;
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#3b82f6', // blue
    won: '#10b981',     // emerald
    lost: '#ef4444',    // red
    completed: '#8b5cf6', // violet
    expired: '#f59e0b',   // amber
    confirmed: '#06b6d4'  // cyan
};

const PieChart = ({ data, onStatusClick }: { data: EstimateStats[], onStatusClick: (status: string) => void }) => {
    const total = data.reduce((sum, d) => sum + d.total, 0);
    const totalCount = data.reduce((sum, d) => sum + d.count, 0);
    
    let startAngle = 0;
    const paths = data.map((d, i) => {
        const angle = total === 0 ? 0 : (d.total / total) * 360;
        // Avoid 360 degree path bug
        const safeAngle = angle >= 360 ? 359.99 : angle;
        const endAngle = startAngle + safeAngle;
        
        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArc = safeAngle > 180 ? 1 : 0;
        
        const pathD = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
        startAngle = endAngle;
        
        const color = STATUS_COLORS[d.status.toLowerCase()] || '#94a3b8';
        
        return <path key={i} d={pathD} fill={color} className="hover:opacity-90 transition-opacity cursor-pointer" onClick={() => onStatusClick(d.status)} />;
    });

    return (
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 mt-8">
            <div className="relative w-48 h-48 drop-shadow-md flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {total > 0 ? paths : (
                        <circle cx="50" cy="50" r="40" fill="#f8fafc" />
                    )}
                    {/* Inner circle to make it a donut chart */}
                    <circle cx="50" cy="50" r="28" fill="white" />
                </svg>
                {/* Total centered in donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Total</span>
                    <span className="text-xl font-black text-slate-800 tracking-tight">
                        ${total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' : total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total.toLocaleString()}
                    </span>
                </div>
            </div>
            
            <div className="flex-1 w-full space-y-3">
                {data.map((d, i) => {
                    const color = STATUS_COLORS[d.status.toLowerCase()] || '#94a3b8';
                    const percentage = total > 0 ? Math.round((d.total / total) * 100) : 0;
                    return (
                        <div key={i} onClick={() => onStatusClick(d.status)} className="group flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl hover:bg-slate-50 transition-all border border-slate-100/50 hover:shadow-sm cursor-pointer">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}15` }}>
                                <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-700 capitalize tracking-wide">{d.status}</span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-100">{d.count}</span>
                                    </div>
                                    <span className="font-black text-slate-900">${Math.round(d.total).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ backgroundColor: color, width: `${percentage}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{percentage}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export function EstimateStatsWidget({ week, scope, initialData, isHidden }: { week: string, scope: 'self'|'all', initialData?: any, isHidden?: boolean }) {
    const router = useRouter();
    const [estimateFilter, setEstimateFilter] = useState('all');
    const { data } = useDashboard(week, scope, 'stats', initialData, estimateFilter);
    const estimateStats = data?.estimateStats ?? [];

    if (isHidden) return null;

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 md:p-8 backdrop-blur-xl h-full flex flex-col">
            <div className="flex items-center gap-4 justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20">
                        <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="font-black text-slate-900 text-2xl tracking-tight">Estimates Overview</h2>
                    </div>
                </div>
                
                <div className="relative">
                    <select 
                        value={estimateFilter}
                        onChange={(e) => setEstimateFilter(e.target.value)}
                        className="appearance-none bg-slate-100/80 border border-slate-200/50 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200 cursor-pointer shadow-inner"
                    >
                        <option value="all">All Time</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="ytd">Year to Date</option>
                        <option value="last_year">Last Year</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>
            {estimateStats.length > 0 ? (
                <PieChart data={estimateStats} onStatusClick={(status) => router.push(`/estimates?status=${encodeURIComponent(status)}`)} />
            ) : (
                <div className="h-32 flex items-center justify-center">
                    <p className="text-slate-400">No data available</p>
                </div>
            )}
        </div>
    );
}
