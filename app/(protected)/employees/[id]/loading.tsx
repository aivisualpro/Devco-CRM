import { Header } from '@/components/ui';

export function PageSkeleton() {
    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            <div className="flex-none bg-white">
                {/* Simulated Header */}
                <div className="h-[72px] flex items-center justify-between px-6 border-b border-gray-100">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="flex gap-2">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
                        <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto">
                <div className="w-full p-4 pb-24">
                    {/* Hero Header Card Skeleton */}
                    <div className="bg-[#eef2f6] rounded-[40px] p-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex flex-col gap-2 p-4 rounded-2xl bg-white/30 border border-white/50 h-[160px] animate-pulse">
                                    <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
                                    <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
                                    <div className="space-y-3 mt-auto">
                                        <div className="h-4 w-full bg-slate-200 rounded" />
                                        <div className="h-4 w-3/4 bg-slate-200 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details Grid Skeleton */}
                    <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse h-[400px]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100" />
                                        <div className="h-5 w-32 bg-slate-100 rounded" />
                                    </div>
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4, 5].map((j) => (
                                            <div key={j} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                <div className="h-3 w-24 bg-slate-100 rounded" />
                                                <div className="h-4 w-32 bg-slate-100 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Records Grid Skeleton */}
                    <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                            <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse h-[300px]" />
                            <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse h-[300px]" />
                            <div className="col-span-1 xl:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse h-[300px]" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function Loading() {
    return <PageSkeleton />;
}
