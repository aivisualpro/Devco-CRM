'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, X, Calendar, Clock, FileText, AlertCircle, Sparkles, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { getPusherClient } from '@/lib/realtime/pusher-client';
import { cld } from '@/lib/cld';
import Image from 'next/image';

interface AppNotification {
    _id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    readAt?: string;
    metadata?: Record<string, any>;
    createdBy?: string;
    createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
    schedule_assigned: <Calendar size={16} className="text-teal-500" />,
    schedule_updated: <Clock size={16} className="text-blue-500" />,
    estimate_won: <Sparkles size={16} className="text-amber-500" />,
    estimate_updated: <FileText size={16} className="text-indigo-500" />,
    task_assigned: <Calendar size={16} className="text-purple-500" />,
    general: <AlertCircle size={16} className="text-slate-500" />,
};

const NOTIFICATION_COLORS: Record<string, string> = {
    schedule_assigned: 'from-teal-500/10 to-teal-500/5 border-teal-200/50',
    schedule_updated: 'from-blue-500/10 to-blue-500/5 border-blue-200/50',
    estimate_won: 'from-amber-500/10 to-amber-500/5 border-amber-200/50',
    estimate_updated: 'from-indigo-500/10 to-indigo-500/5 border-indigo-200/50',
    task_assigned: 'from-purple-500/10 to-purple-500/5 border-purple-200/50',
    general: 'from-slate-500/10 to-slate-500/5 border-slate-200/50',
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell({ currentUser }: { currentUser?: any }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [animateBell, setAnimateBell] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const bellRef = useRef<HTMLButtonElement>(null);
    const prevUnreadRef = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/sounds/notify.mp3');
        audioRef.current.volume = 0.4;
        
        const storedSoundPref = localStorage.getItem(`devco_sound_pref_${currentUser?.email || 'guest'}`);
        if (storedSoundPref !== null) {
            setSoundEnabled(storedSoundPref === 'true');
        }
    }, [currentUser?.email]);

    const playNotificationSound = useCallback(() => {
        if (soundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {/* user hasn't interacted yet */});
        }
    }, [soundEnabled]);

    const toggleSound = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newVal = !soundEnabled;
        setSoundEnabled(newVal);
        localStorage.setItem(`devco_sound_pref_${currentUser?.email || 'guest'}`, String(newVal));
    };

    // Use SWRInfinite for fetching notifications
    const getKey = (pageIndex: number, previousPageData: any) => {
        if (previousPageData && previousPageData.result?.length === 0) return null; 
        return `/api/notifications?page=${pageIndex + 1}&limit=15`;
    };

    const fetcher = (url: string) => fetch(url).then(res => res.json());

    const { data, size, setSize, mutate, isValidating } = useSWRInfinite(getKey, fetcher, {
        refreshInterval: 5000,
        revalidateOnFocus: true,
    });

    const notifications = data ? data.flatMap(page => page.result || []) : [];
    const isLoading = isValidating;
    const hasMore = data && data[data.length - 1]?.page < data[data.length - 1]?.totalPages;
    const unreadCount = data ? (data[0]?.unreadCount || 0) : 0;

    // Request desktop notification permission
    const requestNotificationPermission = useCallback(async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setDesktopNotificationsEnabled(permission === 'granted');
        }
    }, []);

    // Show desktop notification
    const showDesktopNotification = useCallback((title: string, body: string, link?: string, notificationId?: string) => {
        if (!desktopNotificationsEnabled || !('Notification' in window)) return;
        if (document.hasFocus()) return; // Don't show if app is focused

        const notif = new Notification(title, {
            body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: notificationId ? `devco-${notificationId}` : 'devco-notification',
            silent: false,
        });

        notif.onclick = () => {
            window.focus();
            if (link) router.push(link);
            notif.close();
        };

        setTimeout(() => notif.close(), 8000);
    }, [desktopNotificationsEnabled, router]);

    // Premium in-app toast — direct DOM injection (bypasses React tree entirely)
    const showInAppToast = useCallback((payload: any) => {
        if (typeof document === 'undefined') return;

        const cn = payload.metadata?.creatorName || '';
        const ci = payload.metadata?.creatorImage || '';
        const ini = cn ? cn.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

        // Inject keyframes once
        if (!document.getElementById('devco-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'devco-toast-styles';
            style.textContent = `
                @keyframes devcoSlideIn { from { opacity:0; transform:translateY(-8px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
                @keyframes devcoSlideOut { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-8px) scale(0.98); } }
                @keyframes devcoProgress { from { width:100%; } to { width:0%; } }
            `;
            document.head.appendChild(style);
        }

        const el = document.createElement('div');
        el.style.cssText = `
            position:fixed; top:16px; right:16px; z-index:999999;
            display:flex; align-items:center; gap:10px;
            width:340px; max-width:calc(100vw - 32px);
            padding:12px 14px;
            background:rgba(255,255,255,0.96);
            backdrop-filter:blur(20px) saturate(1.6);
            border-radius:14px;
            box-shadow:0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
            cursor:${payload.link ? 'pointer' : 'default'};
            animation:devcoSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
            overflow:hidden;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        `;

        el.innerHTML = `
            <div style="position:absolute;bottom:0;left:0;height:2px;background:linear-gradient(90deg,rgba(15,76,117,0.3),rgba(50,130,184,0.15));animation:devcoProgress 5s linear forwards;border-radius:0 0 14px 14px"></div>
            <div style="width:34px;height:34px;border-radius:10px;overflow:hidden;flex-shrink:0;background:${ci ? 'transparent' : 'linear-gradient(135deg,#0F4C75,#3282B8)'};display:flex;align-items:center;justify-content:center">
                ${ci
                    ? `<img src="${cld(ci, { w: 68, q: 'auto' })}" alt="" style="width:100%;height:100%;object-fit:cover" />`
                    : `<span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:0.3px">${ini}</span>`
                }
            </div>
            <div style="flex:1;min-width:0">
                <p style="margin:0;font-size:12px;font-weight:600;color:#1e293b;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${payload.title || ''}</p>
                <p style="margin:2px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${payload.message || ''}</p>
            </div>
            <div class="devco-toast-close" style="width:20px;height:20px;border-radius:6px;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#cbd5e1;flex-shrink:0;transition:color 0.15s">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        `;

        document.body.appendChild(el);

        const dismiss = () => {
            el.style.animation = 'devcoSlideOut 0.25s ease-in forwards';
            setTimeout(() => el.remove(), 250);
        };

        // Click to navigate
        el.addEventListener('click', () => {
            if (payload.link) router.push(payload.link);
            dismiss();
        });

        // Close button
        el.querySelector('.devco-toast-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });

        // Auto-dismiss after 5s
        setTimeout(dismiss, 5000);
    }, [router]);

    // Pusher Subscribe
    useEffect(() => {
        if (!currentUser?.email) return;
        
        // Ensure pusher env vars are available
        if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return;

        const pusher = getPusherClient();
        if (!pusher) return;
        
        const channelName = `private-notifications-${currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const channel = pusher.subscribe(channelName);
        
        channel.bind('new-notification', (payload: any) => {
            mutate(); // refresh SWR cache
            if (!payload.silent) {
                showDesktopNotification(payload.title, payload.message, payload.link, payload.notificationId);
                showInAppToast(payload);
                playNotificationSound();
                setAnimateBell(true);
                setTimeout(() => setAnimateBell(false), 1000);
            }
        });
        
        return () => {
            channel.unbind_all();
            pusher.unsubscribe(channelName);
        };
    }, [currentUser?.email, mutate, showDesktopNotification, showInAppToast, playNotificationSound]);

    // Check notification permission on mount
    useEffect(() => {
        if ('Notification' in window) {
            setDesktopNotificationsEnabled(Notification.permission === 'granted');
        }
    }, []);

    // Close panel on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                bellRef.current && !bellRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const markAsRead = async (notificationId: string) => {
        mutate((currentData: any) => {
            if (!currentData) return currentData;
            return currentData.map((pageData: any) => ({
                ...pageData,
                result: pageData.result.map((n: any) => 
                    n._id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
                ),
                unreadCount: Math.max(0, (pageData.unreadCount || 0) - 1)
            }));
        }, false);

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markRead', notificationId })
        });
        mutate();
    };

    const markAllRead = async () => {
        mutate((currentData: any) => {
            if (!currentData) return currentData;
            return currentData.map((pageData: any) => ({
                ...pageData,
                result: pageData.result.map((n: any) => ({ ...n, read: true, readAt: new Date().toISOString() })),
                unreadCount: 0
            }));
        }, false);

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markAllRead' })
        });
        mutate();
    };

    const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        
        mutate((currentData: any) => {
            if (!currentData) return currentData;
            return currentData.map((pageData: any) => {
                const notifExists = pageData.result.find((n: any) => n._id === notificationId);
                const isUnread = notifExists && !notifExists.read;
                return {
                    ...pageData,
                    result: pageData.result.filter((n: any) => n._id !== notificationId),
                    unreadCount: isUnread ? Math.max(0, (pageData.unreadCount || 0) - 1) : pageData.unreadCount
                };
            });
        }, false);

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', notificationId })
        });
        mutate();
    };

    const handleNotificationClick = (notif: AppNotification) => {
        if (!notif.read) markAsRead(notif._id);
        if (notif.link) {
            router.push(notif.link);
            setIsOpen(false);
        }
    };

    const loadMore = () => {
        if (hasMore && !isLoading) {
            setSize(size + 1);
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                ref={bellRef}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) mutate();
                }}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-slate-100 focus:outline-none group ${isOpen ? 'bg-slate-100' : ''}`}
                title="Notifications"
            >
                <Bell
                    size={18}
                    className={`text-slate-600 group-hover:text-[#0F4C75] transition-all duration-300 ${animateBell ? 'animate-notification-ring' : ''}`}
                />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-black text-white shadow-lg animate-scale-in"
                        style={{
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                        }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}

                {/* Pulse ring for new notifications */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red-400 animate-ping opacity-40" />
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    className="fixed left-4 right-4 top-[60px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[200] animate-scale-in sm:origin-top-right"
                    style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.03)' }}
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-slate-900 tracking-tight">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #0F4C75, #3282B8)' }}>
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Sound Toggle */}
                                <button
                                    onClick={toggleSound}
                                    className={`p-1.5 rounded-lg transition-all ${soundEnabled ? 'text-[#0F4C75] bg-[#0F4C75]/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                    title={soundEnabled ? 'Sound enabled' : 'Enable sound'}
                                >
                                    {soundEnabled ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                    )}
                                </button>
                                {/* Desktop Notification Toggle */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!desktopNotificationsEnabled) {
                                            requestNotificationPermission();
                                        }
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${desktopNotificationsEnabled ? 'text-[#0F4C75] bg-[#0F4C75]/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                    title={desktopNotificationsEnabled ? 'Desktop notifications enabled' : 'Enable desktop notifications'}
                                >
                                    {desktopNotificationsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                </button>

                                {/* Mark All Read */}
                                {unreadCount > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F4C75] hover:bg-[#0F4C75]/10 transition-all"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck size={14} />
                                    </button>
                                )}

                                {/* Close */}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="overflow-y-auto max-h-[400px] overscroll-contain">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                                    <Bell size={28} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-500">All caught up!</p>
                                <p className="text-xs text-slate-400 mt-1">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {notifications.map((notif, idx) => {
                                    const icon = NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS.general;
                                    const colorClass = NOTIFICATION_COLORS[notif.type] || NOTIFICATION_COLORS.general;

                                    return (
                                        <div
                                            key={notif._id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-slate-50/80 group ${!notif.read ? 'bg-gradient-to-r ' + colorClass : ''}`}
                                            style={{
                                                animationDelay: `${idx * 30}ms`,
                                            }}
                                        >
                                            {/* Unread indicator */}
                                            {!notif.read && (
                                                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0F4C75] shadow-sm" />
                                            )}

                                            {/* Icon or Avatar */}
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 relative overflow-hidden ${!notif.read ? 'bg-white shadow-sm border border-slate-100' : 'bg-slate-100'}`}>
                                                {notif.metadata?.creatorImage ? (
                                                    <Image fill sizes="32px" src={cld(notif.metadata.creatorImage, { w: 64, q: 'auto' })} alt={notif.metadata.creatorName || ''} className="object-cover w-full h-full" />
                                                ) : notif.metadata?.creatorName ? (
                                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{notif.metadata.creatorName[0]}</span>
                                                ) : (
                                                    icon
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[12px] leading-snug ${!notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {notif.message}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                                    {timeAgo(notif.createdAt)}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                {!notif.read && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); markAsRead(notif._id); }}
                                                        className="p-1 rounded-md text-slate-400 hover:text-[#0F4C75] hover:bg-[#0F4C75]/10 transition-all"
                                                        title="Mark as read"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => deleteNotification(notif._id, e)}
                                                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                                {notif.link && (
                                                    <ChevronRight size={12} className="text-slate-300 ml-0.5" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Load More */}
                                {hasMore && (
                                    <button
                                        onClick={loadMore}
                                        disabled={isLoading}
                                        className="w-full py-3 text-xs font-bold text-[#0F4C75] hover:bg-[#0F4C75]/5 transition-all disabled:opacity-50"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-3 h-3 border-2 border-[#0F4C75]/20 border-t-[#0F4C75] rounded-full animate-spin" />
                                                Loading...
                                            </span>
                                        ) : 'Load more'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Keyframe animations */}
            <style jsx>{`
                @keyframes notification-ring {
                    0% { transform: rotate(0deg); }
                    15% { transform: rotate(14deg); }
                    30% { transform: rotate(-14deg); }
                    45% { transform: rotate(10deg); }
                    60% { transform: rotate(-6deg); }
                    75% { transform: rotate(2deg); }
                    100% { transform: rotate(0deg); }
                }
                .animate-notification-ring {
                    animation: notification-ring 0.6s ease-in-out;
                    transform-origin: top center;
                }
            `}</style>

        </div>
    );
}
