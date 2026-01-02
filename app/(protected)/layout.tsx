'use client';

import ChatWidget from '@/components/Chat/ChatWidget';
import MobileNav from '@/components/ui/MobileNav';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Authentication is now handled by middleware.ts
    // No need for client-side auth check - if we're here, user is authenticated

    return (
        <div className="h-screen overflow-hidden flex flex-col relative pb-20 md:pb-0" style={{ background: '#f0f2f5' }}>
            {children}
            <ChatWidget />
            <MobileNav />
        </div>
    );
}
