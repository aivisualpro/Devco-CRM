'use client';

import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';

export function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher: fetcher,
                dedupingInterval: 5000,
                focusThrottleInterval: 60000,
                revalidateOnFocus: false,
                revalidateOnReconnect: true,
                keepPreviousData: true,
                errorRetryCount: 2,
                provider: () => new Map(),
            }}
        >
            {children}
        </SWRConfig>
    );
}
