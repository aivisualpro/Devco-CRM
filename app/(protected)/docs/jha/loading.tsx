import { Header } from "@/components/ui";

export default function Loading() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 p-4 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="h-5 w-24 bg-slate-100 rounded-lg" />
                                <div className="h-5 w-16 bg-slate-100 rounded-full" />
                            </div>
                            <div className="h-4 w-36 bg-slate-50 rounded" />
                            <div className="flex gap-2 mt-2">
                                <div className="h-6 w-6 bg-slate-100 rounded-full" />
                                <div className="h-6 w-6 bg-slate-100 rounded-full" />
                                <div className="h-6 w-6 bg-slate-100 rounded-full" />
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                <div className="h-3 w-20 bg-slate-50 rounded" />
                                <div className="h-3 w-12 bg-slate-50 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
