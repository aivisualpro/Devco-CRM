'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';

/**
 * PWAUpdatePrompt — Industry-standard service worker update flow.
 *
 * Detection strategy (two independent signals):
 *   1. **Service Worker lifecycle** — detects when the browser downloads a new SW
 *      (Serwist precache manifest changes on each Next.js build).
 *   2. **Build-ID polling** — polls /api/version every 60s to detect Vercel
 *      deployments even when the SW update event is delayed.
 *
 * Activation strategy:
 *   - User taps "Update Now" → sends SKIP_WAITING to the waiting SW →
 *     SW activates → page reloads with the new version.
 */
export default function PWAUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const initialBuildId = useRef<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ──────────────────────────────────────────────
    // 1. Service Worker update detection
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        if (process.env.NODE_ENV === 'development') return;

        const registerSW = async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) return;

                // If there's already a waiting worker (e.g. from a previous session)
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setShowPrompt(true);
                }

                // Listen for new SW installations
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        // New SW has installed and is waiting to activate
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setWaitingWorker(newWorker);
                            setShowPrompt(true);
                        }
                    });
                });

                // When the new SW takes over, reload the page
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });

                // Periodically check for SW updates (every 60s)
                const checkInterval = setInterval(() => {
                    registration.update().catch(() => {});
                }, 60 * 1000);

                return () => clearInterval(checkInterval);
            } catch (err) {
                console.error('[PWA] SW registration check failed:', err);
            }
        };

        registerSW();
    }, []);

    // ──────────────────────────────────────────────
    // 2. Build-ID polling (catches deploy even if SW
    //    update event is delayed on mobile Safari)
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (process.env.NODE_ENV === 'development') return;

        const checkVersion = async () => {
            try {
                const res = await fetch('/api/version', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();

                if (!initialBuildId.current) {
                    // First load — store the current build ID
                    initialBuildId.current = data.buildId;
                    return;
                }

                // Build ID changed → new deployment detected
                if (data.buildId !== initialBuildId.current) {
                    setShowPrompt(true);
                    // Try to trigger SW update check
                    const reg = await navigator.serviceWorker?.getRegistration();
                    if (reg) {
                        await reg.update();
                        if (reg.waiting) {
                            setWaitingWorker(reg.waiting);
                        }
                    }
                }
            } catch {
                // Network error — ignore silently
            }
        };

        // Initial check after 5 seconds (let app load first)
        const initialTimeout = setTimeout(checkVersion, 5000);

        // Then poll every 60 seconds
        pollRef.current = setInterval(checkVersion, 60 * 1000);

        return () => {
            clearTimeout(initialTimeout);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ──────────────────────────────────────────────
    // 3. Update action
    // ──────────────────────────────────────────────
    const handleUpdate = useCallback(() => {
        setIsUpdating(true);

        const reload = () => globalThis.location.reload();

        if (waitingWorker) {
            // Tell the waiting SW to skipWaiting → triggers controllerchange → reload
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } else {
            // No waiting SW (detected via build ID polling only) — hard reload
            // Clear all caches then reload
            if ('caches' in globalThis) {
                caches.keys().then(names => {
                    Promise.all(names.map(name => caches.delete(name))).then(reload);
                });
            } else {
                reload();
            }
        }
    }, [waitingWorker]);

    const handleDismiss = useCallback(() => {
        setShowPrompt(false);
        // Re-show after 5 minutes if they dismiss
        setTimeout(() => {
            if (initialBuildId.current) {
                setShowPrompt(true);
            }
        }, 5 * 60 * 1000);
    }, []);

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-slide-up sm:left-auto sm:right-4 sm:w-[380px]">
            <div className="bg-[#0F4C75] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                {/* Header strip */}
                <div className="h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />

                <div className="p-4">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Download size={20} className="text-emerald-300" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-white">Update Available</h4>
                                <button
                                    onClick={handleDismiss}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors -mr-1 -mt-1"
                                    aria-label="Dismiss"
                                >
                                    <X size={14} className="text-white/60" />
                                </button>
                            </div>
                            <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
                                A new version of DEVCO ERP is available. Update now for the latest features and fixes.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 ml-[52px]">
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-[#0F4C75] rounded-xl text-xs font-bold hover:bg-white/90 transition-all shadow-lg disabled:opacity-70"
                        >
                            {isUpdating ? (
                                <RefreshCw size={13} className="animate-spin" />
                            ) : (
                                <RefreshCw size={13} />
                            )}
                            {isUpdating ? 'Updating...' : 'Update Now'}
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
