import { Suspense } from 'react';
import { connectToDatabase } from '@/lib/db';
import { DailyJobTicket, Schedule } from '@/lib/models';
import JobTicketPageClient from './JobTicketsPageClient';
import { Header } from '@/components/ui';

function DJTSkeleton() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />
            <div className="flex-1 p-4 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-52 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default async function JobTicketsPage() {
    await connectToDatabase();

    const [djtDocs, total] = await Promise.all([
        DailyJobTicket.find({})
            .sort({ date: -1, createdAt: -1 })
            .limit(20)
            .lean(),
        DailyJobTicket.countDocuments({}),
    ]);

    // Batch-resolve scheduleRefs for the initial page
    const scheduleIds = djtDocs.map((d: any) => d.schedule_id).filter(Boolean);
    let schedules: any[] = [];
    if (scheduleIds.length > 0) {
        schedules = await Schedule.find({ _id: { $in: scheduleIds } })
            .select('_id title estimate customerId customerName fromDate toDate foremanName projectManager assignees jobLocation DJTSignatures')
            .lean();
    }

    const djtsWithSchedule = djtDocs.map((d: any) => {
        const schedule = schedules.find((s: any) => String(s._id) === String(d.schedule_id));
        return { ...d, scheduleRef: schedule || null };
    });

    const djts = JSON.parse(JSON.stringify(djtsWithSchedule));

    return (
        <Suspense fallback={<DJTSkeleton />}>
            <JobTicketPageClient initialDjts={djts} initialTotal={total} />
        </Suspense>
    );
}
