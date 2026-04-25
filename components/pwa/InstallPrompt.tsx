'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check local storage for dismissal
    const dismissedAt = localStorage.getItem('pwa_install_dismissed_at');
    if (dismissedAt) {
      const dismissTime = parseInt(dismissedAt, 10);
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissTime < fourteenDays) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } else {
      setIsDismissed(false);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsInstallable(false);
    localStorage.setItem('pwa_install_dismissed_at', Date.now().toString());
  };

  if (!isInstallable || isDismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] md:hidden bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5">
      <div className="flex flex-col">
        <h4 className="font-semibold text-sm">Install App</h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Add to home screen for offline access</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleInstall} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          Install
        </button>
        <button onClick={handleDismiss} className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full transition-colors" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
