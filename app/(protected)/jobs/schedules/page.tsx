import { Suspense } from 'react';
import SchedulesTable from './SchedulesTable';
import { headers, cookies } from 'next/headers';
import { Header } from '@/components/ui';
import { SkeletonTable } from '@/components/ui/Skeleton';

function SchedulesPageSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
                <Header />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-2 px-4 pb-4">
                <div className="hidden lg:block h-full">
                    <SkeletonTable rows={8} columns={7} className="h-full" />
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

async function getInitialSchedules() {
    try {
        const today = new Date();
        const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const dayOfWeek = startOfWeek.getUTCDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff);

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setUTCDate(startOfWeek.getUTCDate() + i);
            const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
            dates.push(dateStr);
        }

        const payload = {
            page: 1,
            limit: 100,
            search: '',
            filters: { estimate: '', client: '', employee: '', service: '', tag: '', certifiedPayroll: '' },
            selectedDates: dates,
            skipInitialData: false
        };

        const reqHeaders = await headers();
        const host = reqHeaders.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
        
        const cookieStore = await cookies();
        const cookieString = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        const res = await fetch(`${baseUrl}/api/schedules`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': cookieString
            },
            body: JSON.stringify({ action: 'getSchedulesPage', payload }),
        });
        
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        console.error('Failed to fetch initial schedules', e);
        return null;
    }
}

export default async function SchedulesPage() {
    const initialData = await getInitialSchedules();
    
    // We pass the result directly. It contains { success: true, result: { schedules, initialData, counts, capacity, total, totalPages } }
    return (
        <Suspense fallback={<SchedulesPageSkeleton />}>
            <SchedulesTable serverData={initialData?.result || null} />
        </Suspense>
    );
}
