'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="w-full h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Something went wrong!</h2>
            <p className="text-slate-500">We encountered an unexpected error while loading this page.</p>
            <button
                onClick={() => reset()}
                className="px-6 py-2 bg-[#0F4C75] text-white rounded-md hover:bg-[#0b3c5d] font-bold transition-colors shadow"
            >
                Try again
            </button>
        </div>
    );
}
