'use client';

import { Copy, Trash2, FilePlus, Zap } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';

interface VersionEntry {
    _id: string;
    proposalNo?: string;
    versionNumber?: number;
    date?: string;
    totalAmount?: number;
    status?: string;
    isChangeOrder?: boolean;
    parentVersionId?: string;
}

interface VersionTimelineProps {
    versions: VersionEntry[];
    currentId: string;
    onVersionClick?: (id: string) => void;
    onCloneVersion?: (id: string, versionNumber: number) => void;
    onAddChangeOrder?: (id: string) => void;
    onDeleteVersion?: (id: string, versionNumber: number) => void;
    statusOptions?: { value: string; color?: string }[];
}

export function VersionTimeline({
    versions,
    currentId,
    onVersionClick,
    onCloneVersion,
    onAddChangeOrder,
    onDeleteVersion,
    statusOptions = []
}: VersionTimelineProps) {
    const formatMoney = (val: number) =>
        `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return dateStr;
        }
    };

    const getStatusStyle = (status?: string) => {
        if (!status) return 'bg-gray-100 text-gray-600';
        
        const option = statusOptions.find(opt => opt.value === status);
        if (option?.color) {
            return {
                backgroundColor: `${option.color}20`, // 20 = ~12% opacity hex
                color: option.color,
                borderColor: `${option.color}40`
            };
        }

        // Fallback colors if no constant match
        switch ((status || '').toLowerCase()) {
            case 'won': return 'bg-green-100 text-green-700';
            case 'lost': return 'bg-red-100 text-red-700';
            case 'pending': return 'bg-amber-100 text-amber-700';
            case 'draft': return 'bg-slate-100 text-slate-700';
            case 'confirmed': return 'bg-emerald-100 text-emerald-700';
            case 'in progress': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const regularVersions = versions.filter(v => !v.isChangeOrder);
    const changeOrders = versions.filter(v => v.isChangeOrder);

    const VersionItem = ({ ver, idx, isCO = false }: { ver: VersionEntry, idx: number, isCO?: boolean }) => {
        const isLatest = idx === 0;
        const isCurrent = ver._id === currentId;

        return (
            <div
                key={ver._id}
                onClick={(e) => {
                    // Prevent navigation if already on this version
                    if (isCurrent) return;
                    onVersionClick?.(ver._id);
                }}
                className={`
                    relative group flex items-center gap-2 p-2 rounded-xl transition-colors cursor-pointer
                    ${isCurrent
                        ? 'bg-blue-50/80 shadow-sm border border-blue-100'
                        : 'hover:bg-white/40 border border-transparent'}
                `}
            >
                <div
                    className={`
                        relative w-10 h-10 rounded-full flex items-center justify-center
                        text-xs font-bold text-white shadow-md flex-shrink-0
                        ${isCurrent ? 'bg-blue-600' : isCO ? 'bg-amber-500' : 'bg-slate-300'}
                    `}
                >
                    {isCO ? 'CO' + (ver._id.split('-CO').pop() || idx + 1) : 'V' + (ver.versionNumber || idx + 1)}
                    {isCurrent && (
                        <span className="absolute w-full h-full rounded-full bg-blue-400/20 animate-ping" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5">
                        <div className={`text-[11px] lg:text-[13px] font-bold truncate ${isCurrent ? 'text-blue-800' : 'text-slate-700'}`}>
                            {ver._id}
                        </div>
                        {/* Status Chip Inline */}
                        {ver.status && (() => {
                            const style = getStatusStyle(ver.status);
                            const isObject = typeof style === 'object';
                            return (
                                <span 
                                    className={`px-1.5 py-[1px] text-[8px] font-bold rounded-full uppercase tracking-wide border flex-shrink-0 ${!isObject ? style : ''}`}
                                    style={isObject ? style : undefined}
                                >
                                    {ver.status}
                                </span>
                            );
                        })()}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] lg:text-[11px] text-slate-400">
                        <span>{formatDate(ver.date)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className={`font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>
                            {formatMoney(ver.totalAmount || 0)}
                        </span>
                    </div>
                </div>

                {/* Action Buttons Container */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isCO && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloneVersion?.(ver._id, ver.versionNumber || idx + 1);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all shadow-sm bg-white/80"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Clone this version</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddChangeOrder?.(ver._id);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all shadow-sm bg-white/80"
                                    >
                                        <Zap className="w-3.5 h-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Create Change Order</p>
                                </TooltipContent>
                            </Tooltip>
                        </>
                    )}

                    {(versions.length > 1 || isCO) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteVersion?.(ver._id, ver.versionNumber || idx + 1);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm bg-white/80"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Delete this {isCO ? 'change order' : 'version'}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full p-4 rounded-xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] overflow-hidden">
            {/* Version History Section */}
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/50">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-blue-500 rounded-full" />
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                            Version History
                        </label>
                    </div>
                    {regularVersions.length > 0 && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold border border-blue-100/50">
                            {regularVersions.length}
                        </span>
                    )}
                </div>

                <div className="space-y-2.5 max-h-[130px] overflow-y-auto pr-1 custom-scrollbar">
                    {regularVersions.length > 0 ? (
                        regularVersions.map((ver, idx) => (
                            <VersionItem key={ver._id} ver={ver} idx={idx} />
                        ))
                    ) : (
                        <div className="text-center text-[10px] text-gray-400 py-4 italic">
                            No versions found
                        </div>
                    )}
                </div>
            </div>

            {/* Styled Separator with no massive gap */}
            <div className="py-4">
                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            </div>

            {/* Change Orders Section */}
            <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/50">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-amber-500 rounded-full" />
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                            Change Orders
                        </label>
                    </div>
                    {changeOrders.length > 0 && (
                        <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold border border-amber-100/50">
                            {changeOrders.length}
                        </span>
                    )}
                </div>

                <div className="space-y-2.5 max-h-[130px] overflow-y-auto pr-1 custom-scrollbar">
                    {changeOrders.length > 0 ? (
                        changeOrders.map((ver, idx) => (
                            <VersionItem key={ver._id} ver={ver} idx={idx} isCO={true} />
                        ))
                    ) : (
                        <div className="text-center text-[10px] text-gray-400 py-4 italic">
                            No change orders found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
