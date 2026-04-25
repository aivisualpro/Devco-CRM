import { Header } from "@/components/ui";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <div className="hidden lg:block h-full">
                    <SkeletonTable rows={10} columns={6} className="h-full" />
                </div>
                <div className="lg:hidden space-y-3 pb-8 mt-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}
