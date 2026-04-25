import { Suspense } from 'react';
import MobileNav from '@/components/ui/MobileNav';
import { AppContextProvider } from '@/lib/context/AppContext';
import { PermissionProvider } from '@/hooks/usePermissions';
import { SWRProvider } from '@/components/providers/SWRProvider';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Authentication is now handled by middleware.ts
    // No need for client-side auth check - if we're here, user is authenticated

    return (
        <SWRProvider>
            <AppContextProvider>
                <PermissionProvider>
                <div className="h-[100dvh] overflow-hidden flex flex-col relative pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] lg:pb-0 pt-[env(safe-area-inset-top,0px)]" style={{ background: '#f0f2f5' }}>
                    <Suspense fallback={null}>
                        <OfflineBanner />
                    </Suspense>
                    <Suspense fallback={null}>
                        {children}
                    </Suspense>
                    <Suspense fallback={null}>
                        <GlobalSearch />
                    </Suspense>

                    <Suspense fallback={null}>
                        <MobileNav />
                    </Suspense>
                    
                    <Suspense fallback={null}>
                        <InstallPrompt />
                    </Suspense>
                </div>
                </PermissionProvider>
            </AppContextProvider>
        </SWRProvider>
    );
}

