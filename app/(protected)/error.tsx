'use client';

import { useEffect } from 'react';

export default function ProtectedError({
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
        <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Failed to load content</h2>
            <p className="text-slate-500 max-w-md">An error occurred while loading this section of the dashboard.</p>
            <button
                onClick={() => reset()}
                className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-bold transition-colors shadow"
            >
                Try again
            </button>
        </div>
    );
}
