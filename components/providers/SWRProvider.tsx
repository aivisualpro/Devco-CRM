'use client';

import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';

export function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: false,
                revalidateOnReconnect: true,
                dedupingInterval: 5000,
                fetcher: fetcher,
                shouldRetryOnError: false,
            }}
        >
            {children}
        </SWRConfig>
    );
}
