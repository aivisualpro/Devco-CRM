
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ActivityIcon, Users, ChevronDown } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/Badge';
import Header from '@/components/ui/Header';

interface ActivityItem {
    user: string;
    type: string;
    description: string;
    title: string;
    createdAt: string;
}

export default function DailyActivitiesPage() {
    const { permissions, isSuperAdmin, user } = usePermissions();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    useEffect(() => {
        const fetchActivities = async () => {
            setLoading(true);
            try {
                // Fetch activities
                const activityRes = await fetch('/api/activity?days=30'); // Fetch more history for dedicated page
                const activityData = await activityRes.json();
                
                if (activityData.success) {
                    let filtered = activityData.activities || [];
                    if (!isSuperAdmin && user?.email) {
                        filtered = filtered.filter((a: any) => a.user === user.email);
                    }
                    setActivities(filtered);
                }

                // Fetch employees for names/images if super admin
                if (isSuperAdmin) {
                     const schedRes = await fetch('/api/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            action: 'getSchedulesPage',
                            payload: { 
                                startDate: new Date().toISOString(),
                                endDate: new Date().toISOString(),
                                page: 1, 
                                limit: 1,
                                skipInitialData: false 
                            }
                        })
                    });
                    const schedData = await schedRes.json();
                    if (schedData.success && schedData.result?.initialData) {
                        setEmployees(schedData.result.initialData.employees || []);
                    }
                }

            } catch (err) {
                console.error('Error fetching activities:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchActivities();
        }
    }, [user, isSuperAdmin]);

    // Group activities by user
    const groupedActivities = useMemo(() => {
        const groups: { user: string; items: ActivityItem[] }[] = [];
        activities.forEach(item => {
            const existingGroup = groups.find(g => g.user === item.user);
            if (existingGroup) {
                existingGroup.items.push(item);
            } else {
                groups.push({ user: item.user, items: [item] });
            }
        });
        
        return groups.sort((a, b) => {
            const aTime = new Date(a.items[0]?.createdAt || 0).getTime();
            const bTime = new Date(b.items[0]?.createdAt || 0).getTime();
            return bTime - aTime;
        });
    }, [activities]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
             <Header />
             
             <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                         <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSuperAdmin ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                                {isSuperAdmin ? <Users className="w-6 h-6 text-indigo-600" /> : <ActivityIcon className="w-6 h-6 text-emerald-600" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{isSuperAdmin ? 'Team Activity' : 'My Activity'}</h2>
                                <p className="text-sm text-slate-500">{isSuperAdmin ? 'Recent updates from the team' : 'Your recent updates'}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <div className="text-center py-12">
                                     <p className="text-slate-400">Loading activities...</p>
                                </div>
                            ) : groupedActivities.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-400">No recent activity found</p>
                                </div>
                            ) : (
                                groupedActivities.map((group, groupIdx) => {
                                    const isExpanded = expandedGroups.includes(group.user) || true; // Default expand all for dedicated page? Or keep collapsible. Let's keep collapsible but default open maybe? actually let's use same behavior
                                    
                                    // Use local expanded state if we want toggle, but for a full page report, maybe we want everything visible? 
                                    // The user asked to "move the card", implying same functionality.
                                    // Let's implement the toggle correctly.
                                    
                                    const expanded = expandedGroups.includes(group.user);
                                    
                                    const employeeName = isSuperAdmin ? (employees?.find((e: any) => e.value === group.user)?.label || group.user) : 'You';
                                    
                                    return (
                                        <div key={groupIdx} className="space-y-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                            {/* User Header - Clickable */}
                                            <div 
                                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity select-none group/header"
                                                onClick={() => setExpandedGroups(prev => 
                                                    prev.includes(group.user) 
                                                        ? prev.filter(u => u !== group.user) 
                                                        : [...prev, group.user]
                                                )}
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-[#0F4C75] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                                    {group.user?.[0]?.toUpperCase() || 'S'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{employeeName}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {group.items.length} recent {group.items.length === 1 ? 'activity' : 'activities'}
                                                    </p>
                                                </div>
                                                <div className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                                                    <ChevronDown size={16} className="text-slate-400 group-hover/header:text-[#0F4C75]" />
                                                </div>
                                            </div>

                                            {/* Activity Items */}
                                            {expanded && (
                                                <div className="ml-5 pl-5 border-l-2 border-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    {group.items.map((a, i) => (
                                                        <div key={i} className="relative group">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                                                    {new Date(a.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-700 leading-snug mt-1 font-medium">{a.title}</p>
                                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                                <Badge variant="default" className="text-[10px] py-0 px-2 border-slate-200 text-slate-500 uppercase tracking-tighter">
                                                                    {a.type}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
}
