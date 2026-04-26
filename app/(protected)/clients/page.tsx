import { Suspense } from 'react';
import ClientsTable from './ClientsTable';
import { connectToDatabase } from '@/lib/db';
import { Client } from '@/lib/models';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function ClientsPageSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <div className="hidden lg:block h-full">
                    <SkeletonTable rows={10} columns={5} className="h-full" />
                </div>
                <div className="lg:hidden space-y-3 pb-8 mt-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default async function ClientsPage() {
    await connectToDatabase();
    
    const baseFilter = { status: { $ne: 'deleted' } };
    const [rawClients, total] = await Promise.all([
        Client.find(baseFilter)
            .sort({ name: 1, _id: 1 })
            .limit(25)
            .lean(),
        Client.countDocuments(baseFilter),
    ]);
    
    const page1Data = {
        items: JSON.parse(JSON.stringify(rawClients)),
        total,
        hasMore: rawClients.length === 25,
    };

    return (
        <Suspense fallback={<ClientsPageSkeleton />}>
            <ClientsTable initialData={[page1Data]} />
        </Suspense>
    );
}
