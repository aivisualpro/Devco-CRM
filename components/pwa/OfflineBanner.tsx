'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-400 text-amber-950 px-4 py-1.5 text-xs font-medium flex-shrink-0 flex items-center justify-center gap-2 z-[60] w-full relative">
      <WifiOff className="w-3.5 h-3.5" />
      <span>You are currently offline. Some features may be limited.</span>
    </div>
  );
}
