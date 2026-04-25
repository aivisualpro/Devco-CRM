'use client';

import React, { useState, useEffect } from 'react';
import {
    Loader2, GraduationCap, Calendar, FileText,
    CheckCircle2, AlertTriangle, Clock, RefreshCw, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/context/AppContext';

import { Header, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

interface TrainingRecord {
    category?: string;
    type?: string;
    frequency?: string;
    assignedDate?: string;
    completionDate?: string;
    renewalDate?: string;
    description?: string;
    status?: string;
    fileUrl?: string;
    createdBy?: string;
    createdAt?: string;
}

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    profilePicture?: string;
    trainingCertifications?: TrainingRecord[];
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return formatWallDate(d);
    } catch {
        return '-';
    }
}

function getStatusColor(status?: string) {
    if (!status) return 'bg-slate-100 text-slate-500 border-slate-200';
    const s = status.toLowerCase();
    if (s === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'expired') return 'bg-red-100 text-red-700 border-red-200';
    if (s === 'in progress' || s === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
}

function getStatusIcon(status?: string) {
    if (!status) return <Clock size={12} />;
    const s = status.toLowerCase();
    if (s === 'completed') return <CheckCircle2 size={12} />;
    if (s === 'expired') return <AlertTriangle size={12} />;
    return <Clock size={12} />;
}

function handleViewFile(url?: string) {
    if (!url) {
        toast.error('No file available');
        return;
    }
    if (url.includes('res.cloudinary.com')) {
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent('training_document')}`;
        window.open(proxyUrl, '_blank');
        return;
    }
    window.open(url, '_blank');
}

export default function TrainingsPage() {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const currentUser = useCurrentUser();

    useEffect(() => {
        fetchMyTrainings();
    }, []);

    const fetchMyTrainings = async () => {
        setLoading(true);
        try {
            const email = currentUser?.email || currentUser?._id;
            if (!email) {
                toast.error('Unable to identify logged in user');
                setLoading(false);
                return;
            }
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEmployeeById', payload: { id: email } })
            });
            const data = await res.json();
            if (data.success) {
                setEmployee(data.result);
            } else {
                toast.error('Failed to load training data');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred loading trainings');
        } finally {
            setLoading(false);
        }
    };

    const trainings = employee?.trainingCertifications || [];
    const completedCount = trainings.filter(t => t.status?.toLowerCase() === 'completed').length;
    const expiredCount = trainings.filter(t => t.status?.toLowerCase() === 'expired').length;
    const pendingCount = trainings.length - completedCount - expiredCount;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />

            <div className="flex-1 overflow-auto pb-24">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" size={28} />
                            <span className="text-sm text-slate-500">Loading your trainings...</span>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-5xl mx-auto p-4 lg:p-6">
                        {/* Header Section */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0F4C75] to-[#3282B8] flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <GraduationCap size={22} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-slate-900">My Training & Certifications</h1>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : ''}
                                    {trainings.length > 0 && ` • ${trainings.length} record${trainings.length !== 1 ? 's' : ''}`}
                                </p>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        {trainings.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 p-3 sm:p-4 shadow-sm text-center">
                                    <div className="text-2xl sm:text-3xl font-black text-emerald-600">{completedCount}</div>
                                    <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Completed</div>
                                </div>
                                <div className={cn(
                                    "rounded-2xl border p-3 sm:p-4 shadow-sm text-center",
                                    pendingCount > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100" : "bg-white border-slate-100"
                                )}>
                                    <div className={cn("text-2xl sm:text-3xl font-black", pendingCount > 0 ? "text-amber-600" : "text-slate-300")}>{pendingCount}</div>
                                    <div className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1", pendingCount > 0 ? "text-amber-500" : "text-slate-400")}>Pending</div>
                                </div>
                                <div className={cn(
                                    "rounded-2xl border p-3 sm:p-4 shadow-sm text-center",
                                    expiredCount > 0 ? "bg-gradient-to-br from-red-50 to-red-100/50 border-red-100" : "bg-white border-slate-100"
                                )}>
                                    <div className={cn("text-2xl sm:text-3xl font-black", expiredCount > 0 ? "text-red-600" : "text-slate-300")}>{expiredCount}</div>
                                    <div className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1", expiredCount > 0 ? "text-red-500" : "text-slate-400")}>Expired</div>
                                </div>
                            </div>
                        )}

                        {trainings.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                                <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No training or certifications found.</p>
                                <p className="text-xs text-slate-400 mt-1">Training records will appear here once assigned to you.</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Card View */}
                                <div className="lg:hidden space-y-3">
                                    {trainings.map((rec, i) => (
                                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                            {/* Top: Type + Status */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-slate-800">{rec.type || 'Untitled'}</div>
                                                    {rec.category && (
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{rec.category}</span>
                                                    )}
                                                </div>
                                                {rec.status && (
                                                    <Badge className={cn(
                                                        "shrink-0 text-[10px] font-bold border flex items-center gap-1",
                                                        getStatusColor(rec.status)
                                                    )}>
                                                        {getStatusIcon(rec.status)}
                                                        {rec.status}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Description */}
                                            {rec.description && (
                                                <p className="text-xs text-slate-500 mb-3">{rec.description}</p>
                                            )}

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                {rec.frequency && (
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">Frequency</span>
                                                        <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                                                            <RefreshCw size={10} className="text-slate-400" /> {rec.frequency}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">Assigned</span>
                                                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                                                        <Calendar size={10} className="text-slate-400" /> {formatDate(rec.assignedDate)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">Completed</span>
                                                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                                                        <CheckCircle2 size={10} className="text-emerald-500" /> {formatDate(rec.completionDate)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">Renewal</span>
                                                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                                                        <RefreshCw size={10} className="text-amber-500" /> {formatDate(rec.renewalDate)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* File Link */}
                                            {rec.fileUrl && (
                                                <div className="mt-3 pt-3 border-t border-slate-50">
                                                    <button
                                                        onClick={() => handleViewFile(rec.fileUrl)}
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C75] hover:text-[#0a3a5c] transition-colors"
                                                    >
                                                        <ExternalLink size={12} />
                                                        View Certificate
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden lg:block">
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frequency</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Renewal</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                        <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">File</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {trainings.map((rec, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs">{rec.category || '-'}</td>
                                                            <td className="py-2.5 px-4 text-slate-800 font-semibold text-xs">{rec.type || '-'}</td>
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs">{rec.frequency || '-'}</td>
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">{formatDate(rec.assignedDate)}</td>
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">{formatDate(rec.completionDate)}</td>
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">{formatDate(rec.renewalDate)}</td>
                                                            <td className="py-2.5 px-4 text-slate-600 text-xs max-w-[200px] truncate">{rec.description || '-'}</td>
                                                            <td className="py-2.5 px-4">
                                                                {rec.status ? (
                                                                    <span className={cn(
                                                                        "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border",
                                                                        getStatusColor(rec.status)
                                                                    )}>
                                                                        {getStatusIcon(rec.status)}
                                                                        {rec.status}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4">
                                                                {rec.fileUrl ? (
                                                                    <button
                                                                        onClick={() => handleViewFile(rec.fileUrl)}
                                                                        className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium hover:bg-emerald-100 transition-colors cursor-pointer"
                                                                    >
                                                                        View File
                                                                    </button>
                                                                ) : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
