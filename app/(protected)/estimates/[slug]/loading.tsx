import { Header, FullEstimateSkeleton } from '@/components/ui';

export default function Loading() {
    return (
        <div className="flex flex-col h-screen bg-[#F4F7FA]">
            <div className="flex-none">
                <Header />
            </div>
            <FullEstimateSkeleton />
        </div>
    );
}
