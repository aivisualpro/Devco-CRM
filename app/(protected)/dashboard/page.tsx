'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRoot() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/jobschedule');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="h-4 w-32 bg-slate-100 rounded"></div>
            </div>
        </div>
    );
}
