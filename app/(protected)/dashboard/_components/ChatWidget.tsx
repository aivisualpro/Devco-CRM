'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { MessageSquare, Search, X, Reply, Forward, Edit, Trash2, Send } from 'lucide-react';
import { getPusherClient } from '@/lib/realtime/pusher-client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { MyDropDown } from '@/components/ui/MyDropDown';

interface ChatWidgetProps {
    initialData: any;
    userEmail: string;
    canViewEstimates: boolean;
    searchParamsView: string | null;
}

export function ChatWidget({ initialData, userEmail, canViewEstimates, searchParamsView }: ChatWidgetProps) {
    const [mentionQuery, setMentionQuery] = useState('');
    const [referenceQuery, setReferenceQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [showReferences, setShowReferences] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0); 
    const [chatFilterValue, setChatFilterValue] = useState(''); 
    const [tagFilters, setTagFilters] = useState<{type: 'user'|'estimate', value: string, label: string}[]>([]);
    const [chatAssignees, setChatAssignees] = useState<string[]>([]);
    const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
    const [chatEstimate, setChatEstimate] = useState<{value: string, label: string} | null>(null);
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgText, setEditingMsgText] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [longPressMsgId, setLongPressMsgId] = useState<string | null>(null);
    const [chatScope, setChatScope] = useState<'self' | 'all'>('self');
    const [canViewAllChats, setCanViewAllChats] = useState(false);
    const [chatHasMore, setChatHasMore] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const dismissLongPress = () => setLongPressMsgId(null);
    const chatUserScrolledUp = useRef(false);
    const chatInitialLoad = useRef(true);

    const chatUrl = useMemo(() => {
        let url = `/api/chat?limit=50&scope=${chatScope}`;
        if (chatFilterValue) {
            url += `&filter=${encodeURIComponent(chatFilterValue)}`;
        }
        if (tagFilters.length > 0) {
             const estTag = tagFilters.find(t => t.type === 'estimate');
             if (estTag) {
                 url += `&estimate=${encodeURIComponent(estTag.value)}`;
             }
        }
        return url;
    }, [chatFilterValue, tagFilters, chatScope]);

    const { data: chatData, mutate: mutateChatMessages } = useSWR(
        chatUrl,
        (url) => fetch(url).then(res => res.json()),
        {
            revalidateOnFocus: true,
            onSuccess: (data) => {
                if (data?.success) {
                    if (data.canViewAll !== undefined) setCanViewAllChats(data.canViewAll);
                    setChatHasMore(data.hasMore ?? false);
                    if (chatInitialLoad.current || !chatUserScrolledUp.current) {
                        setTimeout(() => {
                            if (chatScrollRef.current) {
                                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }
                        }, 100);
                    }
                    chatInitialLoad.current = false;
                }
            }
        }
    );
    const messages: any[] = chatData?.messages || [];

    // ── Load Older Messages (scroll up) ──
    const loadOlderMessages = useCallback(async () => {
        if (isLoadingOlder || !chatHasMore || messages.length === 0) return;
        setIsLoadingOlder(true);
        const oldestId = messages[0]?._id;
        const scrollEl = chatScrollRef.current;
        const prevScrollHeight = scrollEl?.scrollHeight ?? 0;
        try {
            let url = `/api/chat?limit=50&scope=${chatScope}&before=${oldestId}`;
            if (chatFilterValue) url += `&filter=${encodeURIComponent(chatFilterValue)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.success && data.messages?.length > 0) {
                mutateChatMessages((current: any) => {
                    if (!current) return current;
                    const existingIds = new Set((current.messages || []).map((m: any) => m._id));
                    const newMsgs = data.messages.filter((m: any) => !existingIds.has(m._id));
                    return {
                        ...current,
                        messages: [...newMsgs, ...(current.messages || [])],
                        hasMore: data.hasMore,
                    };
                }, false);
                setChatHasMore(data.hasMore ?? false);
                // Preserve scroll position after prepending
                requestAnimationFrame(() => {
                    if (scrollEl) {
                        scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight;
                    }
                });
            } else {
                setChatHasMore(false);
            }
        } catch (err) {
            console.error('Failed to load older messages', err);
        } finally {
            setIsLoadingOlder(false);
        }
    }, [isLoadingOlder, chatHasMore, messages, chatScope, chatFilterValue, mutateChatMessages]);

    // ── Pusher real-time subscription ──
    useEffect(() => {
        const pusher = getPusherClient();
        if (!pusher) return;

        const channel = pusher.subscribe('private-org-chat');

        channel.bind('chat-created', (payload: any) => {
            if (payload.actor === userEmail) return; // already applied via optimistic update
            const newMsg = payload.message;
            if (newMsg) {
                mutateChatMessages((currentData: any) => {
                    if (!currentData) return { success: true, messages: [newMsg] };
                    // Prevent duplicates
                    if (currentData.messages?.some((m: any) => m._id === newMsg._id)) return currentData;
                    return {
                        ...currentData,
                        messages: [...(currentData.messages || []), newMsg]
                    };
                }, false);
                // Auto-scroll to bottom for incoming messages
                if (!chatUserScrolledUp.current) {
                    setTimeout(() => {
                        if (chatScrollRef.current) {
                            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        }
                    }, 100);
                }
            }
        });

        channel.bind('chat-updated', (payload: any) => {
            if (payload.actor === userEmail) return;
            const updated = payload.message;
            if (updated) {
                mutateChatMessages((currentData: any) => {
                    if (!currentData) return currentData;
                    return {
                        ...currentData,
                        messages: (currentData.messages || []).map((m: any) =>
                            m._id === updated._id ? updated : m
                        )
                    };
                }, false);
            }
        });

        channel.bind('chat-deleted', (payload: any) => {
            if (payload.actor === userEmail) return;
            if (payload.messageId) {
                mutateChatMessages((currentData: any) => {
                    if (!currentData) return currentData;
                    return {
                        ...currentData,
                        messages: (currentData.messages || []).filter((m: any) => m._id !== payload.messageId)
                    };
                }, false);
            }
        });

        return () => {
            channel.unbind_all();
            pusher.unsubscribe('private-org-chat');
        };
    }, [userEmail, mutateChatMessages]);

    const handleChatInput = (e: React.ChangeEvent<any>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart || 0;
        setCursorPosition(cursor);
        
        const textBefore = val.slice(0, cursor);
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            setMentionQuery(lastWord.slice(1));
            setShowMentions(true);
            setShowReferences(false);
        } else if (lastWord.startsWith('#')) {
            setReferenceQuery(lastWord.slice(1));
            setShowReferences(true);
            setShowMentions(false);
        } else {
            setShowMentions(false);
            setShowReferences(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const currentMessage = chatInputRef.current?.value || '';
        if (!currentMessage.trim()) return;

        const estimateMatch = currentMessage.match(/#(\d+[-A-Za-z0-9]*)/);
        const extractedEstimate = estimateMatch ? estimateMatch[1] : undefined;

        const safeAssignees = chatAssignees.map(val => {
            const emailStr = typeof val === 'string' ? val : (val as any)?.email || '';
            if (!emailStr) return { email: '', name: 'Unknown' };
            const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === emailStr.toLowerCase());
            return {
                email: emailStr,
                name: emp?.label || emailStr
            };
        }).filter(a => a.email);

        const resolvedEstimate = chatEstimate?.value || extractedEstimate;

        const optimisticMsg: any = {
            _id: `temp-${Date.now()}`,
            sender: userEmail,
            message: currentMessage,
            estimate: resolvedEstimate,
            assignees: safeAssignees,
            replyTo: replyingTo ? {
                _id: replyingTo._id,
                sender: replyingTo.sender,
                message: replyingTo.message
            } : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        mutateChatMessages((currentData: any) => {
            if (!currentData) return { success: true, messages: [optimisticMsg] };
            return {
                ...currentData,
                messages: [...(currentData.messages || []), optimisticMsg]
            };
        }, false);
        if (chatInputRef.current) {
            chatInputRef.current.value = '';
            (chatInputRef.current as any).style.height = '42px';
        }
        setChatAssignees([]);
        setReplyingTo(null);
        
        chatUserScrolledUp.current = false;
        setTimeout(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }, 50);

        try {
            const chatRes = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: optimisticMsg.message,
                    estimate: resolvedEstimate,
                    assignees: safeAssignees,
                    replyTo: optimisticMsg.replyTo
                })
            });
            const chatResData = await chatRes.json();

            // Replace temp optimistic message with real server response
            if (chatResData?.success && chatResData.message) {
                mutateChatMessages((currentData: any) => {
                    if (!currentData) return currentData;
                    return {
                        ...currentData,
                        messages: (currentData.messages || []).map((m: any) =>
                            m._id === optimisticMsg._id ? chatResData.message : m
                        )
                    };
                }, false);
            }
            setChatEstimate(null);

            if (safeAssignees.length > 0) {
                try {
                    const taggedEstimate = resolvedEstimate;
                    let estimateFields: any = {};
                    if (taggedEstimate) {
                        const estObj = initialData.estimates?.find((e: any) => e.estimate === taggedEstimate);
                        if (estObj) {
                            estimateFields = {
                                estimate: estObj.estimate,
                                customerId: estObj.customerId || '',
                                customerName: estObj.customerName || '',
                                jobAddress: estObj.jobAddress || ''
                            };
                        } else {
                            estimateFields = { estimate: taggedEstimate };
                        }
                    }

                    const taskRes = await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task: currentMessage.replace(/@\S+/g, '').replace(/#\S+/g, '').trim() || currentMessage,
                            status: 'todo',
                            assignees: safeAssignees.map((a: any) => a.email),
                            createdBy: userEmail || 'System',
                            ...estimateFields
                        })
                    });
                    if (taskRes.ok) {
                        // Mutate global SWR to refresh tasks
                        mutate(
                            (key: any) => typeof key === 'string' && key.startsWith('/api/dashboard'),
                            undefined,
                            { revalidate: true }
                        );
                    }
                } catch (e) {
                    console.error('Failed to create task from chat mention', e);
                }
            }
        } catch (e) {
            console.error('Failed to send message', e);
            mutateChatMessages(); 
        }
    };

    const handleDeleteMessage = async (id: string) => {
        try {
            mutateChatMessages((currentData: any) => {
                if (!currentData) return currentData;
                return {
                    ...currentData,
                    messages: currentData.messages.filter((m: any) => m._id !== id)
                };
            }, false);

            await fetch(`/api/chat/${id}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error('Failed to delete message', e);
            mutateChatMessages(); 
        }
    };

    const handleUpdateMessage = async (id: string, newMessage: string) => {
        if (!newMessage.trim()) return;
        
        try {
            setEditingMsgId(null);
            mutateChatMessages((currentData: any) => {
                if (!currentData) return currentData;
                return {
                    ...currentData,
                    messages: currentData.messages.map((m: any) => 
                        m._id === id ? { ...m, message: newMessage } : m
                    )
                };
            }, false);

            await fetch(`/api/chat/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage })
            });
        } catch (e) {
            console.error('Failed to update message', e);
            mutateChatMessages();
        }
    };

    const filteredEmployeeOptions = useMemo(() => {
        if (!initialData.employees) return [];
        return initialData.employees.filter((emp: any) => 
            emp.label?.toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 10).map((emp: any) => ({
            id: emp.value,
            value: emp.value,
            label: emp.label,
            profilePicture: emp.image
        }));
    }, [initialData.employees, mentionQuery]);

    const estimateOptions = useMemo(() => {
        if (!initialData.estimates) return [];
        return initialData.estimates
            .filter((est: any) => (est.estimate && est.estimate.toLowerCase().includes(referenceQuery.toLowerCase())) || 
                                (est.projectName && est.projectName.toLowerCase().includes(referenceQuery.toLowerCase())))
            .slice(0, 10)
            .map((est: any) => ({
                id: est.estimate,
                value: est.estimate,
                label: `${est.estimate}${est.projectName ? ` - ${est.projectName}` : ''}`
            }));
    }, [initialData.estimates, referenceQuery]);

    // The entire rendering of the Chat Widget
    return (
        <div className={`col-span-12 xl:col-span-3 space-y-4 ${searchParamsView === 'chat' ? 'block h-full lg:h-auto min-h-0 overflow-hidden lg:overflow-visible' : 'hidden lg:block'}`}>                            {/* Chat */}
                            <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sticky top-0 z-10 ${searchParamsView === 'chat' ? 'h-full lg:h-[calc(100vh-100px)]' : 'h-[calc(100vh-100px)]'}`}>
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm z-20">
                                    <div className="hidden lg:flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-[#0F4C75]" />
                                        <h2 className="font-bold text-slate-900 text-sm">Chat</h2>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 lg:flex-initial justify-center lg:justify-end">
                                        {canViewAllChats && (
                                            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                                                <button 
                                                    onClick={() => { setChatScope('self'); chatInitialLoad.current = true; }}
                                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${chatScope === 'self' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Self
                                                </button>
                                                <button 
                                                    onClick={() => { setChatScope('all'); chatInitialLoad.current = true; }}
                                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${chatScope === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    All
                                                </button>
                                            </div>
                                        )}
                                        <div className="relative w-full max-w-[180px]">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Search chat..." 
                                                value={chatFilterValue}
                                                onChange={(e) => setChatFilterValue(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[#0F4C75]/10 focus:border-[#0F4C75] transition-all"
                                            />
                                            {chatFilterValue && (
                                                <button 
                                                    onClick={() => setChatFilterValue('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div 
                                    className="flex-1 p-4 overflow-y-auto overscroll-contain space-y-4 scrollbar-thin bg-slate-50/50 select-none lg:select-auto"
                                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                                    ref={chatScrollRef}
                                    onScroll={() => {
                                        if (chatScrollRef.current) {
                                            const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
                                            // Consider "near bottom" if within 80px of the bottom
                                            chatUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 80;
                                            // Load older messages when scrolled near top
                                            if (scrollTop < 80 && chatHasMore && !isLoadingOlder) {
                                                loadOlderMessages();
                                            }
                                        }
                                    }}
                                >
                                    {isLoadingOlder && (
                                        <div className="flex justify-center py-2">
                                            <div className="text-[10px] font-bold text-slate-400 animate-pulse">Loading older messages...</div>
                                        </div>
                                    )}
                                    {(chatFilterValue ? messages.filter(msg => {
                                        const query = chatFilterValue.toLowerCase().trim();
                                        if (!query) return true;

                                        const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                        const senderName = senderEmp?.label || msg.sender || '';
                                        
                                        // Check assignees
                                        const hasMatchingAssignee = Array.isArray(msg.assignees) && msg.assignees.some((assignee: string | { email: string, name: string }) => {
                                             if (typeof assignee === 'string') {
                                                const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === assignee.toLowerCase());
                                                const name = emp?.label || assignee;
                                                return name.toLowerCase().includes(query);
                                             } else {
                                                const name = assignee.name || '';
                                                const email = assignee.email || '';
                                                return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
                                             }
                                        });

                                        return (
                                            msg.message?.toLowerCase().includes(query) ||
                                            senderName.toLowerCase().includes(query) ||
                                            msg.estimate?.toLowerCase().includes(query) ||
                                            hasMatchingAssignee
                                        );
                                    }) : messages).length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-sm text-slate-400">
                                                {chatFilterValue ? 'No matching messages found' : 'No messages yet. Start the conversation!'}
                                            </p>
                                        </div>
                                    ) : (
                                        (chatFilterValue ? messages.filter(msg => {
                                            const query = chatFilterValue.toLowerCase().trim();
                                            if (!query) return true;

                                            const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                            const senderName = senderEmp?.label || msg.sender || '';
                                            
                                            // Check assignees
                                            const hasMatchingAssignee = Array.isArray(msg.assignees) && msg.assignees.some((assignee: string | { email: string, name: string }) => {
                                                 if (typeof assignee === 'string') {
                                                    const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === assignee.toLowerCase());
                                                    const name = emp?.label || assignee;
                                                    return name.toLowerCase().includes(query);
                                                 } else {
                                                    const name = assignee.name || '';
                                                    const email = assignee.email || '';
                                                    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
                                                 }
                                            });

                                            return (
                                                msg.message?.toLowerCase().includes(query) ||
                                                senderName.toLowerCase().includes(query) ||
                                                msg.estimate?.toLowerCase().includes(query) ||
                                                hasMatchingAssignee
                                            );
                                        }) : messages).map((msg, idx) => {
                                            const isMe = msg.sender?.toLowerCase() === userEmail?.toLowerCase() && !!userEmail;
                                            const isEditing = editingMsgId === msg._id;
                                            const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                            const senderInitials = (senderEmp?.label || msg.sender || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase();

                                            const renderMessage = (text: string) => {
                                                const parts = text.split(/(@[\w.@]+|#\d+[-A-Za-z0-9]*)/g);
                                                return parts.map((part, i) => {
                                                    if (part.startsWith('@')) {
                                                        const label = part.slice(1);
                                                        // Check if this person is already an assignee (hide them from text if they are)
                                                        const isAssignee = msg.assignees?.some((assignee: string | { email: string, name: string }) => {
                                                            const email = typeof assignee === 'string' ? assignee : assignee.email;
                                                            const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === email?.toLowerCase());
                                                            return emp?.label === label || email === label;
                                                        });
                                                        
                                                        if (isAssignee) return null;
                                                        return <span key={i} className={`font-bold ${isMe ? 'text-white/90 underline decoration-white/40' : 'text-[#0F4C75] underline decoration-[#0F4C75]/30'}`}>{part}</span>;
                                                    }
                                                    if (part.startsWith('#')) return <span key={i} className={`font-bold cursor-pointer hover:underline ${isMe ? 'text-white/90' : 'text-[#0F4C75]'}`} onClick={() => {
                                                        const estVal = part.slice(1);
                                                        setTagFilters([{ type: 'estimate', value: estVal, label: part }]);
                                                    }}>{part}</span>;

                                                    if (!chatFilterValue) return part;

                                                    // Escape special regex characters in filter value
                                                    const escapedFilter = chatFilterValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                    const regex = new RegExp(`(${escapedFilter})`, 'gi');
                                                    const subParts = part.split(regex);
                                                    
                                                    return subParts.map((subPart, j) => 
                                                        subPart.toLowerCase() === chatFilterValue.toLowerCase() ? 
                                                            <span key={`${i}-${j}`} className="bg-yellow-200 text-slate-900 rounded-[2px] px-0.5 font-bold shadow-sm">{subPart}</span> : 
                                                            subPart
                                                    );
                                                });
                                            };

                                            const HeaderContent = () => {
                                                const AssigneesAvatars = (
                                                    <div className="flex -space-x-1.5 overflow-hidden">
                                                        {msg.assignees && msg.assignees.length > 0 ? (
                                                            msg.assignees.map((assignee: string | { email: string, name: string }, aIdx: number) => {
                                                                const email = typeof assignee === 'string' ? assignee : assignee.email;
                                                                const assEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === email?.toLowerCase());
                                                                const displayName = typeof assignee === 'string' ? (assEmp?.label || email) : (assignee.name || assEmp?.label || assignee.email);
                                                                
                                                                return (
                                                                    <Tooltip key={aIdx}>
                                                                        <TooltipTrigger asChild>
                                                                            <Avatar className="w-6 h-6 border-2 border-white shrink-0">
                                                                                {assEmp?.image && <AvatarImage src={assEmp.image} />}
                                                                                <AvatarFallback className="text-[9px] bg-transparent font-extrabold text-white border border-white/40">
                                                                                    {(() => { const parts = (displayName || 'U').split(' ').filter((p: string) => p.length > 0); return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (displayName || 'U')[0].toUpperCase(); })()}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="text-[10px] font-bold">{displayName}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                );
                                                            })
                                                        ) : null}
                                                    </div>
                                                );

                                                const SenderAvatar = (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className={`w-7 h-7 border-2 shrink-0 ${isMe ? 'border-[#0F4C75]/30' : 'border-white'}`}>
                                                                <AvatarImage src={senderEmp?.image} />
                                                                <AvatarFallback className={`text-[10px] font-black ${isMe ? 'bg-[#0F4C75] text-white' : 'bg-[#0F4C75]/10 text-[#0F4C75]'}`}>
                                                                    {isMe ? 'ME' : senderInitials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-[10px] font-bold">{isMe ? 'You' : (senderEmp?.label || msg.sender)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );

                                                if (isMe) {
                                                    return (
                                                        <div className="flex items-center justify-between mb-2">
                                                            {AssigneesAvatars}
                                                            {SenderAvatar}
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="flex items-center justify-between mb-2 flex-row-reverse">
                                                            {AssigneesAvatars}
                                                            {SenderAvatar}
                                                        </div>
                                                    );
                                                }
                                            };

                                            return (
                                                <div id={msg._id} key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end group mb-0.5`}>
                                                    
                                                    <div 
                                                        className={`rounded-2xl p-1 min-w-[160px] max-w-[85%] relative transition-all duration-300 ${
                                                            highlightedMsgId === msg._id ? 'ring-2 ring-[#0F4C75]/40 scale-[1.02]' : ''
                                                        } ${
                                                            isMe 
                                                                ? 'bg-[#0F4C75] text-white rounded-br-none' 
                                                                : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
                                                        }`}
                                                        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                                        onTouchStart={(e) => {
                                                            longPressTimer.current = setTimeout(() => {
                                                                setLongPressMsgId(msg._id);
                                                            }, 500);
                                                        }}
                                                        onTouchEnd={() => {
                                                            if (longPressTimer.current) {
                                                                clearTimeout(longPressTimer.current);
                                                                longPressTimer.current = null;
                                                            }
                                                        }}
                                                        onTouchMove={() => {
                                                            if (longPressTimer.current) {
                                                                clearTimeout(longPressTimer.current);
                                                                longPressTimer.current = null;
                                                            }
                                                        }}
                                                    >
                                                        {/* Desktop hover actions for own messages */}
                                                        {isMe && !isEditing && (
                                                            <div className="hidden lg:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-full top-1/2 -translate-y-1/2 mr-1 z-10">
                                                                <button 
                                                                    onClick={() => {
                                                                        setReplyingTo(msg);
                                                                        setHighlightedMsgId(msg._id);
                                                                        setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                                    title="Reply"
                                                                >
                                                                    <Reply size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (msg.assignees?.length) {
                                                                            const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                            setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                        }
                                                                        const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                        if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="Forward"
                                                                >
                                                                    <Forward size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => { setEditingMsgId(msg._id); setEditingMsgText(msg.message); }}
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                >
                                                                    <Edit size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteMessage(msg._id)}
                                                                    className="p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <HeaderContent />

                                                        {/* Reply Citation */}
                                                        {msg.replyTo && (
                                                            <div 
                                                                onClick={() => {
                                                                    const el = document.getElementById(msg.replyTo._id);
                                                                    if (el) {
                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        setHighlightedMsgId(msg.replyTo._id);
                                                                        setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                    }
                                                                }}
                                                                className={`mb-1 mx-1 p-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                                                                    isMe 
                                                                        ? 'bg-white/10 border-l-2 border-white/30 text-white/80' 
                                                                        : 'bg-slate-50 border-l-2 border-[#0F4C75]/30 text-slate-500'
                                                                }`}
                                                            >
                                                                <p className="font-bold opacity-75 mb-0.5">{msg.replyTo.sender?.split('@')[0]}</p>
                                                                <p className="truncate line-clamp-1 italic opacity-90">{msg.replyTo.message}</p>
                                                            </div>
                                                        )}

                                                        {/* Message Content */}
                                                        <div className="px-1">
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <textarea 
                                                                        autoFocus
                                                                        className="w-full bg-white/15 border border-white/20 rounded-lg p-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
                                                                        value={editingMsgText}
                                                                        onChange={(e) => setEditingMsgText(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                                e.preventDefault();
                                                                                handleUpdateMessage(msg._id, editingMsgText);
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingMsgId(null);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <button onClick={() => setEditingMsgId(null)} className="text-[10px] font-bold uppercase hover:underline">Cancel</button>
                                                                        <button onClick={() => handleUpdateMessage(msg._id, editingMsgText)} className="text-[10px] font-bold uppercase hover:underline">Save</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm cursor-text selection:bg-white/30 whitespace-pre-wrap leading-relaxed">
                                                                    {renderMessage(msg.message)}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Footer: Timestamp & Actions */}
                                                        {!isEditing && (
                                                            <div className={`flex items-center justify-end mt-1 px-1`}>
                                                                
                                                            <div className="flex items-center gap-2">
                                                                {msg.estimate && (
                                                                    <span 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (canViewEstimates) {
                                                                                window.open(`/estimates/${encodeURIComponent((msg.estimate as any).value || msg.estimate)}`, "_self");
                                                                            }
                                                                        }}
                                                                        className={`${canViewEstimates ? 'cursor-pointer hover:opacity-80' : ''} text-[8px] font-bold px-1.5 py-px rounded uppercase tracking-tight leading-none ${isMe ? 'bg-white/20 text-white border border-white/20' : 'bg-[#0F4C75]/10 text-[#0F4C75] border border-[#0F4C75]/15'}`}
                                                                    >
                                                                        #{(msg.estimate as any).value || msg.estimate}
                                                                    </span>
                                                                )}
                                                                <span className={`text-[8px] uppercase tracking-widest font-medium opacity-60 shrink-0 ${isMe ? 'text-white' : 'text-slate-400'}`}>
                                                                    {(() => { const d = new Date(msg.createdAt); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); let h = d.getHours(); const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; const min = String(d.getMinutes()).padStart(2, '0'); return `${mm}/${dd}, ${h}:${min} ${ampm}`; })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        )}
                                                        {/* Mobile Long-Press Action Popup */}
                                                        {longPressMsgId === msg._id && (
                                                            <>
                                                                <div className="fixed inset-0 z-[200] lg:hidden" style={{ touchAction: 'none' }} onClick={() => dismissLongPress()} />
                                                                <div className={`absolute z-[201] lg:hidden animate-in fade-in zoom-in-95 duration-150 ${
                                                                    isMe ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'
                                                                }`}>
                                                                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-w-[140px]">
                                                                        <button
                                                                            onClick={() => {
                                                                                setReplyingTo(msg);
                                                                                setHighlightedMsgId(msg._id);
                                                                                setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                                chatInputRef.current?.focus();
                                                                                dismissLongPress();
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                                                        >
                                                                            <Reply size={14} className="text-[#0F4C75]" />
                                                                            Reply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (msg.assignees?.length) {
                                                                                    const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                                    setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                                }
                                                                                const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                                                                                                    if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                                chatInputRef.current?.focus();
                                                                                dismissLongPress();
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-100"
                                                                        >
                                                                            <Forward size={14} className="text-[#0F4C75]" />
                                                                            Forward
                                                                        </button>
                                                                        {isMe && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingMsgId(msg._id);
                                                                                        setEditingMsgText(msg.message);
                                                                                        dismissLongPress();
                                                                                    }}
                                                                                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-100"
                                                                                >
                                                                                    <Edit size={14} className="text-[#0F4C75]" />
                                                                                    Edit
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        handleDeleteMessage(msg._id);
                                                                                        dismissLongPress();
                                                                                    }}
                                                                                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors border-t border-slate-100"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                    Delete
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                        {/* Desktop hover actions for other's messages */}
                                                        {!isMe && (
                                                            <div className="hidden lg:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute left-full top-1/2 -translate-y-1/2 ml-1 z-10">
                                                                <button 
                                                                    onClick={() => {
                                                                        setReplyingTo(msg);
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                                    title="Reply"
                                                                >
                                                                    <Reply size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (msg.assignees?.length) {
                                                                            const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                            setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                        }
                                                                        const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                        if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="Forward"
                                                                >
                                                                    <Forward size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    

                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-3 border-t border-slate-100 relative">
                                    <MyDropDown
                                        isOpen={showMentions}
                                        onClose={() => setShowMentions(false)}
                                        options={filteredEmployeeOptions}
                                        selectedValues={chatAssignees}
                                        onSelect={(val) => {
                                            if (!chatAssignees.includes(val)) {
                                                setChatAssignees(prev => [...prev, val]);
                                            } else {
                                                setChatAssignees(prev => prev.filter(v => v !== val));
                                            }
                                            
                                            // Remove trigger text
                                            const text = chatInputRef.current?.value || '';
                                            const before = text.slice(0, cursorPosition);
                                            const lastAt = before.lastIndexOf('@');
                                            if (lastAt >= 0) {
                                                const newText = before.slice(0, lastAt) + text.slice(cursorPosition);
                                                if (chatInputRef.current) chatInputRef.current.value = newText;
                                                
                                                setTimeout(() => {
                                                    if (chatInputRef.current) {
                                                        chatInputRef.current.focus();
                                                        const newPos = lastAt;
                                                        chatInputRef.current.setSelectionRange(newPos, newPos);
                                                        setCursorPosition(newPos);
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        multiSelect={true}
                                        anchorId="chat-input-container"
                                        width="w-64"
                                        showSearch={false}
                                    />

                                    <MyDropDown
                                        isOpen={showReferences}
                                        onClose={() => setShowReferences(false)}
                                        options={estimateOptions}
                                        selectedValues={chatEstimate ? [chatEstimate.value] : []}
                                        onSelect={(val) => {
                                            const selected = estimateOptions.find((o: any) => o.value === val);
                                            if (selected) {
                                                setChatEstimate({ value: selected.value, label: selected.label });
                                            }
                                            
                                            // Remove trigger text
                                            const text = chatInputRef.current?.value || '';
                                            const before = text.slice(0, cursorPosition);
                                            const lastHash = before.lastIndexOf('#');
                                            if (lastHash >= 0) {
                                                const newText = before.slice(0, lastHash) + text.slice(cursorPosition);
                                                if (chatInputRef.current) chatInputRef.current.value = newText;
                                                setShowReferences(false);
                                                setTimeout(() => {
                                                    if (chatInputRef.current) {
                                                        chatInputRef.current.focus();
                                                        const newPos = lastHash;
                                                        chatInputRef.current.setSelectionRange(newPos, newPos);
                                                        setCursorPosition(newPos);
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        multiSelect={false}
                                        anchorId="chat-input-container"
                                        width="w-80"
                                        showSearch={true}
                                    />

                                    <form 
                                        onSubmit={handleSendMessage} 
                                        className="flex flex-col gap-2"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    >
                                        {chatAssignees.length > 0 && (
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Assigning:</span>
                                                <div className="flex -space-x-1.5 overflow-hidden">
                                                    {chatAssignees.map((val: string, i: number) => {
                                                        const emailVal = typeof val === 'string' ? val : (val as any).email;
                                                        const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === emailVal?.toLowerCase());
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className="cursor-pointer hover:scale-110 transition-transform"
                                                                onClick={() => setChatAssignees(prev => prev.filter(v => v !== val))}
                                                            >
                                                                <Avatar className="w-5 h-5 border border-white shrink-0 shadow-sm">
                                                                    <AvatarImage src={emp?.image} />
                                                                    <AvatarFallback className="text-[8px] bg-slate-200">
                                                                        {(emp?.label || emailVal || 'U')[0].toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setChatAssignees([])}
                                                    className="text-[9px] text-red-500 font-bold hover:underline ml-1"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                        {chatEstimate && (
                                             <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Linking:</span>
                                                <div className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <span 
                                                        className={`text-[10px] font-bold ${canViewEstimates ? 'cursor-pointer hover:underline' : ''}`}
                                                        onClick={() => {
                                                            if (canViewEstimates) window.open(`/estimates/${encodeURIComponent(chatEstimate.value)}`, '_self');
                                                        }}
                                                    >
                                                        {chatEstimate.label}
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setChatEstimate(null)}
                                                        className="hover:text-purple-900"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        
                                        {/* Replying Banner */}
                                        {replyingTo && (
                                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-t-xl border-b border-slate-100 text-xs">
                                                 <div className="flex items-center gap-2 overflow-hidden">
                                                    <Reply size={12} className="text-slate-400 shrink-0" />
                                                    <div className="flex flex-col truncate">
                                                        <span className="font-bold text-slate-700">Replying to {replyingTo.sender}</span>
                                                        <span className="text-slate-500 truncate">{replyingTo.message}</span>
                                                    </div>
                                                 </div>
                                                 <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full">
                                                    <X size={12} />
                                                 </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1" id="chat-input-container">
                                                <textarea 
                                                    ref={chatInputRef as any}
                                                    placeholder="Type @ for team or # for jobs..."
                                                    className="w-full px-4 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all placeholder:text-slate-400 resize-none h-10 leading-10 max-h-32 overflow-y-auto"
                                                    rows={1}
                                                    defaultValue=""
                                                    onInput={(e: any) => {
                                                        const target = e.target;
                                                        target.style.height = '40px';
                                                        target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                                    }}
                                                    onChange={handleChatInput}
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="w-10 h-10 bg-[#0F4C75] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-all shadow-sm hover:shadow-md shrink-0"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>



                        </div>

    );
}
