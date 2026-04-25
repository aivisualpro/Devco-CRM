import { Suspense } from 'react';
import ClientsTable from './ClientsTable';
import { connectToDatabase } from '@/lib/db';
import { Client } from '@/lib/models';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    await connectToDatabase();
    
    // Server-side fetch first page
    const rawClients = await Client.find({ status: { $ne: 'deleted' } })
        .sort({ name: 1, _id: 1 })
        .limit(25)
        .lean();
        
    const total = await Client.countDocuments({ status: { $ne: 'deleted' } });
        
    // Serialize initialData (handle ObjectIds)
    const page1Data = {
        items: JSON.parse(JSON.stringify(rawClients)),
        total,
        hasMore: rawClients.length === 25
    };

    return (
        <Suspense fallback={null}>
            <ClientsTable initialData={[page1Data]} />
        </Suspense>
    );
}
