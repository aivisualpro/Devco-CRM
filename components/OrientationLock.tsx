'use client';

import { useEffect } from 'react';

export default function OrientationLock() {
    useEffect(() => {
        const lockOrientation = async () => {
            if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
                try {
                    // This works on some browsers (mostly Android/Chrome)
                    // and usually requires being in standalone mode (installed as PWA)
                    await (window.screen.orientation as any).lock('portrait').catch(() => {});
                } catch (err) {
                    // Silently fail if not supported
                }
            }
        };

        lockOrientation();

        // Also add a listener for orientation change to handle edge cases
        const handleOrientationChange = () => {
            if (window.innerHeight < window.innerWidth && window.innerWidth < 1024) {
               // Landscape mode on a relatively small screen
            }
        };

        window.addEventListener('orientationchange', handleOrientationChange);
        return () => window.removeEventListener('orientationchange', handleOrientationChange);
    }, []);

    return null;
}
