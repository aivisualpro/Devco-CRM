import { Header } from "@/components/ui";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header showDashboardActions={true} />
            </div>
            <div className="p-4 sm:p-6 lg:p-8 flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        </div>
    );
}
