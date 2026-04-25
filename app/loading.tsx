import { SkeletonCard } from "@/components/ui/Skeleton";

export default function RootLoading() {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="w-full max-w-md p-8">
                <SkeletonCard />
            </div>
        </div>
    );
}
