'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ChatWidget from '@/components/Chat/ChatWidget';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const sessionValid = localStorage.getItem('devco_session_valid');
        if (!sessionValid) {
            router.push('/login');
        } else {
            setIsAuthenticated(true);
        }
    }, [router]);

    // Show nothing while checking auth
    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col relative" style={{ background: '#f0f2f5' }}>
            {children}
            <ChatWidget />
        </div>
    );
}
