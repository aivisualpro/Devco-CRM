import { Suspense } from 'react';
import EstimatesTable from './EstimatesTable';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';

export const dynamic = 'force-dynamic';

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
        <Suspense fallback={null}>
            <EstimatesTable initialData={initialData} />
        </Suspense>
    );
}
