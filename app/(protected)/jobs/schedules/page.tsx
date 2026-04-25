import { Suspense } from 'react';
import SchedulesTable from './SchedulesTable';

export default function SchedulesPage() {
    return (
        <Suspense fallback={null}>
            <SchedulesTable />
        </Suspense>
    );
}
