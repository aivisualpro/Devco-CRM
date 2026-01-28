import { Suspense } from 'react';
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
            <div className="h-screen overflow-hidden flex flex-col relative pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] md:pb-0 pt-[env(safe-area-inset-top,0px)]" style={{ background: '#f0f2f5' }}>
                <Suspense fallback={null}>
                    {children}
                </Suspense>

                <Suspense fallback={null}>
                    <MobileNav />
                </Suspense>
            </div>
        </PermissionProvider>
    );
}

