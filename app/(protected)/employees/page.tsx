import { Suspense } from 'react';
import EmployeesTable from './EmployeesTable';
import { connectToDatabase } from '@/lib/db';
import { Employee, Role } from '@/lib/models';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function EmployeesPageSkeleton() {
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

export default async function EmployeesPage() {
    await connectToDatabase();
    
    const baseFilter = { status: { $ne: 'deleted' } };
    const [rawEmployees, total, roles] = await Promise.all([
        Employee.find(baseFilter)
            .select('-password -refreshToken -__v')
            .sort({ updatedAt: -1 })
            .limit(25)
            .lean(),
        Employee.countDocuments(baseFilter),
        Role.find().sort({ order: 1 }).lean(),
    ]);
    
    const page1Data = {
        items: JSON.parse(JSON.stringify(rawEmployees)),
        total,
        hasMore: rawEmployees.length === 25,
    };

    return (
        <Suspense fallback={<EmployeesPageSkeleton />}>
            <EmployeesTable initialData={[page1Data]} initialRoles={JSON.parse(JSON.stringify(roles))} />
        </Suspense>
    );
}
