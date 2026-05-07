import { Suspense } from 'react';
import WIPReportClient from './WIPReportClient';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { headers } from 'next/headers';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function WIPReportSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <SkeletonTable rows={8} columns={10} className="h-full" />
            </div>
        </div>
    );
}

import { computeWipCalculations } from '@/app/api/quickbooks/projects/route';

async function getInitialProjects() {
    try {
        // Always compute fresh — never use unstable_cache here.
        // The Suspense skeleton handles the ~4s load time gracefully.
        const projects = await computeWipCalculations();
        return JSON.parse(JSON.stringify(projects));
    } catch (e) {
        console.error('Failed to fetch initial projects', e);
        return [];
    }
}

async function getInitialEmployees() {
    try {
        await connectToDatabase();
        const employees = await Employee.find({ status: { $ne: 'deleted' } })
            .select('-password -refreshToken -__v')
            .lean();
        return JSON.parse(JSON.stringify(employees));
    } catch (e) {
        return [];
    }
}

import { EquipmentItem } from '@/lib/models';

async function getInitialEquipment() {
    try {
        await connectToDatabase();
        const equipment = await EquipmentItem.find().sort({ createdAt: -1 }).lean();
        return JSON.parse(JSON.stringify(equipment));
    } catch (e) {
        return [];
    }
}

export default async function WIPReportPage() {
    const [initialProjects, initialEmployees, initialEquipment] = await Promise.all([
        getInitialProjects(),
        getInitialEmployees(),
        getInitialEquipment()
    ]);

    return (
        <Suspense fallback={<WIPReportSkeleton />}>
            <WIPReportClient 
                initialProjects={initialProjects} 
                initialEmployees={initialEmployees} 
                initialEquipment={initialEquipment} 
            />
        </Suspense>
    );
}
