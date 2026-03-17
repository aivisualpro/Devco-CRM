'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, X, Calendar, Clock, FileText, AlertCircle, Sparkles, ChevronRight, Volume2, VolumeX } from 'lucide-react';

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
    general: <AlertCircle size={16} className="text-slate-500" />,
};

const NOTIFICATION_COLORS: Record<string, string> = {
    schedule_assigned: 'from-teal-500/10 to-teal-500/5 border-teal-200/50',
    schedule_updated: 'from-blue-500/10 to-blue-500/5 border-blue-200/50',
    estimate_won: 'from-amber-500/10 to-amber-500/5 border-amber-200/50',
    estimate_updated: 'from-indigo-500/10 to-indigo-500/5 border-indigo-200/50',
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

export default function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
    const [animateBell, setAnimateBell] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const bellRef = useRef<HTMLButtonElement>(null);
    const prevUnreadRef = useRef(0);

    // Request desktop notification permission
    const requestNotificationPermission = useCallback(async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setDesktopNotificationsEnabled(permission === 'granted');
        }
    }, []);

    // Show desktop notification
    const showDesktopNotification = useCallback((title: string, body: string, link?: string) => {
        if (!desktopNotificationsEnabled || !('Notification' in window)) return;
        if (document.hasFocus()) return; // Don't show if app is focused

        const notif = new Notification(title, {
            body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'devco-notification',
            silent: false,
        });

        notif.onclick = () => {
            window.focus();
            if (link) router.push(link);
            notif.close();
        };

        // Auto-close after 8 seconds
        setTimeout(() => notif.close(), 8000);
    }, [desktopNotificationsEnabled, router]);

    // Fetch notifications
    const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/notifications?page=${pageNum}&limit=15`);
            const data = await res.json();

            if (data.success) {
                if (append) {
                    setNotifications(prev => [...prev, ...data.result]);
                } else {
                    setNotifications(data.result);
                }

                const newUnread = data.unreadCount;

                // Show desktop notification if new unread notifications appeared
                if (newUnread > prevUnreadRef.current && prevUnreadRef.current >= 0 && pageNum === 1) {
                    const latestUnread = data.result.find((n: AppNotification) => !n.read);
                    if (latestUnread) {
                        showDesktopNotification(latestUnread.title, latestUnread.message, latestUnread.link);
                        // Animate bell
                        setAnimateBell(true);
                        setTimeout(() => setAnimateBell(false), 1000);
                    }
                }

                prevUnreadRef.current = newUnread;
                setUnreadCount(newUnread);
                setHasMore(data.page < data.totalPages);
                setPage(pageNum);
            } else {
                console.warn('[NotificationBell] API returned non-success:', data);
            }
        } catch (error) {
            console.error('[NotificationBell] Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [showDesktopNotification]);

    // Poll for new notifications every 15 seconds
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(() => fetchNotifications(), 15000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

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
        setNotifications(prev =>
            prev.map(n => n._id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markRead', notificationId })
        });
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
        setUnreadCount(0);

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'markAllRead' })
        });
    };

    const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const notif = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        if (notif && !notif.read) setUnreadCount(prev => Math.max(0, prev - 1));

        await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', notificationId })
        });
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
            fetchNotifications(page + 1, true);
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                ref={bellRef}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) fetchNotifications();
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
                    className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[200] animate-scale-in origin-top-right"
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

                                            {/* Icon */}
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${!notif.read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                                {icon}
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
