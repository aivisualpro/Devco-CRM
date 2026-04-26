import { Suspense } from 'react';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';
import BillingTicketsClient from './BillingTicketsClient';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function BillingTicketsSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <SkeletonTable rows={8} columns={6} className="h-full" />
            </div>
        </div>
    );
}

export default async function BillingTicketsPage() {
    await connectToDatabase();

    // Only fetch estimates that have billing tickets
    const estimates = await Estimate.find({
        billingTickets: { $exists: true, $ne: [] },
        status: { $ne: 'deleted' }
    })
        .select('_id estimate versionNumber projectName billingTickets')
        .sort({ estimate: -1 })
        .limit(500)
        .lean();

    const initialEstimates = JSON.parse(JSON.stringify(estimates));

    return (
        <Suspense fallback={<BillingTicketsSkeleton />}>
            <BillingTicketsClient initialEstimates={initialEstimates} />
        </Suspense>
    );
}
