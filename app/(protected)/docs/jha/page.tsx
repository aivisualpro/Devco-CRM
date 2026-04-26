import { Suspense } from 'react';
import { connectToDatabase } from '@/lib/db';
import { JHA } from '@/lib/models';
import JHAPageClient from './JHAPageClient';
import { Header } from '@/components/ui';

function JHASkeleton() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />
            <div className="flex-1 p-4 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-52 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default async function JHAPage() {
    await connectToDatabase();

    const [jhaDocs, total] = await Promise.all([
        JHA.find({}).sort({ date: -1 }).limit(20).lean(),
        JHA.countDocuments({}),
    ]);

    // Minimal hydration — full enrichment happens client-side via the GET handler
    const jhas = JSON.parse(JSON.stringify(jhaDocs));

    return (
        <Suspense fallback={<JHASkeleton />}>
            <JHAPageClient initialJhas={jhas} initialTotal={total} />
        </Suspense>
    );
}
