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
                <div className="w-full px-4 py-4 pb-24 max-w-[1600px] mx-auto">
                    
                    {/* Header Card Skeleton */}
                    <div className="bg-[#eef2f6] rounded-[40px] p-4 mb-4">
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
                    
                    {/* Content Sections Skeletons */}
                    <div className="flex flex-col gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse" />
                                        <div>
                                            <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-1" />
                                            <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-4">
                                        <div className="h-12 w-full bg-slate-50 rounded-xl animate-pulse" />
                                        <div className="h-12 w-full bg-slate-50 rounded-xl animate-pulse" />
                                        <div className="h-12 w-full bg-slate-50 rounded-xl animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function Loading() {
    return <PageSkeleton />;
}
