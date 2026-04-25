import { Suspense } from 'react';
import EmployeesTable from './EmployeesTable';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
    await connectToDatabase();
    
    // Server-side fetch first page
    const rawEmployees = await Employee.find({ status: { $ne: 'deleted' } })
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean();
        
    const total = await Employee.countDocuments({ status: { $ne: 'deleted' } });
        
    const page1Data = {
        items: JSON.parse(JSON.stringify(rawEmployees)),
        total,
        hasMore: rawEmployees.length === 25
    };

    return (
        <Suspense fallback={null}>
            <EmployeesTable initialData={[page1Data]} />
        </Suspense>
    );
}
