'use client';


import MobileNav from '@/components/ui/MobileNav';
import { PermissionProvider } from '@/hooks/usePermissions';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Authentication is now handled by middleware.ts
    // No need for client-side auth check - if we're here, user is authenticated

    return (
        <PermissionProvider>
            <div className="h-screen overflow-hidden flex flex-col relative pb-20 md:pb-0 pt-[env(safe-area-inset-top,0px)]" style={{ background: '#f0f2f5' }}>
                {children}

                <MobileNav />
            </div>
        </PermissionProvider>
    );
}
