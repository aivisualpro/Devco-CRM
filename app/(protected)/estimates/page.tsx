import { Suspense } from 'react';
import EstimatesTable from './EstimatesTable';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function EstimatesPageSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <div className="hidden lg:block h-full">
                    <SkeletonTable rows={10} columns={8} className="h-full" />
                </div>
                <div className="lg:hidden space-y-3 pb-8 mt-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-36 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default async function EstimatesPage() {
    await connectToDatabase();
    
    // Server-side fetch first page matching default sort (estimate: -1)
    const rawEstimates = await Estimate.find({ status: { $ne: 'deleted' } })
        .select('-labor -equipment -material -tools -overhead -subcontractor -disposal -miscellaneous -proposals -proposal -receiptsAndCosts -billingTickets -jobPlanningDocs -releases -intentToLien -legalDocs -aerialImage -siteLayout -scopeOfWork -htmlContent -customVariables -coiDocument -notes -projectDescription -siteConditions')
        .sort({ estimate: -1, updatedAt: -1 })
        .limit(30)
        .lean();
        
    const initialData = JSON.parse(JSON.stringify(rawEstimates));

    return (
        <Suspense fallback={<EstimatesPageSkeleton />}>
            <EstimatesTable initialData={initialData} />
        </Suspense>
    );
}
