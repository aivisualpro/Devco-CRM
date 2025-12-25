'use client';

interface VersionEntry {
    _id: string;
    proposalNo?: string;
    versionNumber?: number;
    date?: string;
    totalAmount?: number;
}

interface VersionTimelineProps {
    versions: VersionEntry[];
    currentId: string;
    onVersionClick?: (id: string) => void;
}

export function VersionTimeline({
    versions,
    currentId,
    onVersionClick
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

    return (
        <div className="flex flex-col h-full p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Version History
                </label>
                {versions.length > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full font-bold">
                        {versions.length} versions
                    </span>
                )}
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {versions.length > 0 ? (
                    versions.map((ver, idx) => {
                        const isLatest = idx === 0;
                        const isCurrent = ver._id === currentId;

                        return (
                            <div
                                key={ver._id}
                                onClick={() => onVersionClick?.(ver._id)}
                                className={`
                                    group flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer
                                    ${isCurrent
                                        ? 'bg-blue-50/80 shadow-sm border border-blue-100'
                                        : 'hover:bg-white/40 border border-transparent'}
                                `}
                            >
                                <div
                                    className={`
                                        relative w-8 h-8 rounded-full flex items-center justify-center
                                        text-xs font-bold text-white shadow-md
                                        ${isCurrent ? 'bg-blue-600' : 'bg-slate-300'}
                                    `}
                                >
                                    V{ver.versionNumber || idx + 1}
                                    {isCurrent && (
                                        <span className="absolute w-full h-full rounded-full bg-blue-400/20 animate-ping" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`text-sm font-bold ${isCurrent ? 'text-blue-800' : 'text-slate-700'}`}>
                                            {ver.proposalNo || '0000'}-V.{ver.versionNumber || idx + 1}
                                        </div>
                                        {isLatest && (
                                            <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wide">
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span>{formatDate(ver.date)}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className={`font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>
                                            {formatMoney(ver.totalAmount || 0)}
                                        </span>
                                    </div>
                                </div>
                                {!isCurrent && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg
                                            className="w-4 h-4 text-blue-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-xs text-gray-400 py-4 italic">
                        No history found
                    </div>
                )}
            </div>
        </div>
    );
}
