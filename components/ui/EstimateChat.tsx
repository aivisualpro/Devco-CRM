'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Pencil, Reply, X, MessageSquare, Forward } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, MyDropDown } from '@/components/ui';

interface EstimateChatProps {
    estimateId: string;
    currentUserEmail?: string;
    employees?: any[];
    className?: string;
    height?: string;
}

export const EstimateChat: React.FC<EstimateChatProps> = ({
    estimateId,
    currentUserEmail,
    employees = [],
    className = '',
    height = '500px'
}) => {
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [chatAssignees, setChatAssignees] = useState<string[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0); 
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgText, setEditingMsgText] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);

    // Fetch Chat Messages
    useEffect(() => {
        if (!estimateId) return;

        const fetchChat = async () => {
            try {
                const res = await fetch(`/api/chat?limit=50&estimate=${encodeURIComponent(estimateId)}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.success) {
                    setChatMessages(data.messages);
                    // Scroll to bottom on initial load
                    setTimeout(() => {
                        if (chatScrollRef.current) {
                            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Failed to fetch estimate chat', error);
            }
        };

        fetchChat();
        const interval = setInterval(fetchChat, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [estimateId]);

    const handleChatInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewChatMessage(val);
        
        const cursor = e.target.selectionStart || 0;
        setCursorPosition(cursor);
        
        // Check for trigger at cursor
        const textBefore = val.slice(0, cursor);
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            setMentionQuery(lastWord.slice(1));
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const handleSendChatMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newChatMessage.trim() || !estimateId) return;

        const optimisticMsg = {
            _id: `temp-${Date.now()}`,
            sender: currentUserEmail || 'Me',
            senderName: currentUserEmail || 'Me',
            message: newChatMessage,
            assignees: chatAssignees,
            createdAt: new Date().toISOString(),
            replyTo: replyingTo ? {
                _id: replyingTo._id,
                sender: replyingTo.sender,
                message: replyingTo.message
            } : undefined
        };

        setChatMessages(prev => [...prev, optimisticMsg]);
        setNewChatMessage('');
        setChatAssignees([]);
        
        // Reset textarea height
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
        }
        
        // Scroll to bottom
        setTimeout(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }, 50);

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: optimisticMsg.message,
                    estimate: estimateId,
                    assignees: chatAssignees,
                    replyTo: replyingTo ? {
                        _id: replyingTo._id,
                        sender: replyingTo.sender,
                        message: replyingTo.message
                    } : undefined
                })
            });
            setReplyingTo(null);
            // fetchChat will sync eventual ID
        } catch (error) {
            console.error('Failed to send', error);
            toast.error('Failed to send message');
        }
    };

    const handleUpdateMessage = async (id: string, text: string) => {
        if (!text.trim()) return;
        try {
            const res = await fetch(`/api/chat/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            if (data.success) {
                setChatMessages(prev => prev.map(m => m._id === id ? { ...m, message: text } : m));
                setEditingMsgId(null);
                setEditingMsgText('');
                toast.success('Message updated');
            } else {
                toast.error(data.error || 'Failed to update');
            }
        } catch (error) {
            toast.error('Operation failed');
        }
    };

    const handleDeleteMessage = (id: string) => {
        if (window.confirm('Are you sure you want to delete this message?')) {
             deleteMessage(id);
        }
    };

    const deleteMessage = async (id: string) => {
         try {
            const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setChatMessages(prev => prev.filter(m => m._id !== id));
                toast.success('Message deleted');
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete message');
        }
    };

    // Employee options for assignees display - Build this first for use in filteredChatOptions
    const employeeOptions = React.useMemo(() => {
        return (employees || []).map(e => ({
            id: e._id || e.id || e.email,
            label: e.label || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
            value: e.email || e.id || e._id,
            profilePicture: e.image || e.profilePicture
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [employees]);

    // Filter chat options for mentions - formatted for MyDropDown (matches original EstimateDocsCard)
    const filteredChatOptions = React.useMemo(() => {
        console.log('[EstimateChat] employeeOptions:', employeeOptions?.length, 'mentionQuery:', mentionQuery, 'showMentions:', showMentions);
        
        const source = employeeOptions;
        if (!mentionQuery) {
            // Return first 100 when just @ is typed (no query)
            return source.slice(0, 100);
        }
        // Filter by query
        return source.filter(e => e.label.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 50);
    }, [mentionQuery, employeeOptions, showMentions]);

    return (
        <TooltipProvider>
        <div className={`space-y-4 ${className}`}>
             <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white flex items-center justify-center shadow-md">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">Estimate Chat</h4>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    #{estimateId}
                </span>
            </div>

            <div className={`p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] flex flex-col relative`} style={{ height }}>
                <div 
                    className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200"
                    ref={chatScrollRef}
                >
                    {chatMessages.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-[10px] text-slate-400 font-bold">No messages for this estimate yet.</p>
                        </div>
                    ) : (
                        chatMessages.map((msg, idx) => {
                            const isMe = (currentUserEmail && msg.sender?.toLowerCase() === currentUserEmail.toLowerCase()) || msg.senderName === 'Me';
                            
                            // Find sender employee
                            const senderEmp = employees.find(e => 
                                e.email?.toLowerCase() === msg.sender?.toLowerCase() || 
                                e._id === msg.sender ||
                                e.value?.toLowerCase() === msg.sender?.toLowerCase()
                            );
                            const senderLabel = senderEmp?.label || senderEmp?.firstName || msg.senderName || msg.sender || 'U';
                            const senderInitials = senderLabel.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                            const renderMessage = (text: string) => {
                                const parts = text.split(/(@[\w.@]+)/g);
                                return parts.map((part, i) => {
                                    if (part.startsWith('@')) {
                                        const label = part.slice(1);
                                        // Check if this person is already an assignee (hide them from text if they are)
                                        const isAssignee = msg.assignees?.some((email: string) => {
                                            const emp = employees.find(e => 
                                                e.email?.toLowerCase() === email?.toLowerCase() ||
                                                e._id === email ||
                                                e.value?.toLowerCase() === email?.toLowerCase()
                                            );
                                            return (emp?.label === label || emp?.firstName === label) || email === label;
                                        });
                                        
                                        if (isAssignee) return null;
                                        return <span key={i} className={`font-bold ${isMe ? 'text-blue-200' : 'text-blue-600'}`}>{part}</span>;
                                    }
                                    return part;
                                });
                            };

                            const HeaderContent = () => {
                                const AssigneesAvatars = (
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                        {msg.assignees && msg.assignees.length > 0 ? (
                                            msg.assignees.map((email: string, aIdx: number) => {
                                                const assEmp = employees.find(e => 
                                                    e.email?.toLowerCase() === email?.toLowerCase() || 
                                                    e._id === email ||
                                                    e.value?.toLowerCase() === email?.toLowerCase()
                                                );
                                                const assName = assEmp?.label || assEmp?.firstName || email || 'U';
                                                return (
                                                    <Tooltip key={aIdx}>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className="w-5 h-5 border-[1.5px] border-white/20 shrink-0">
                                                                <AvatarImage src={assEmp?.image || assEmp?.profilePicture} />
                                                                <AvatarFallback className="text-[8px] bg-slate-200 font-extrabold text-[#0F4C75]">
                                                                    {assName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-[10px] font-bold">{assName}</p>
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
                                            <Avatar className={`w-6 h-6 border-[1.5px] shrink-0 ${isMe ? 'border-white/20' : 'border-white'}`}>
                                                <AvatarImage src={senderEmp?.image || senderEmp?.profilePicture} />
                                                <AvatarFallback className={`text-[9px] font-black ${isMe ? 'bg-[#112D4E] text-white' : 'bg-slate-300 text-slate-700'}`}>
                                                    {isMe ? 'ME' : senderInitials}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-[10px] font-bold">{isMe ? 'You' : senderLabel}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );

                                if (isMe) {
                                    return (
                                        <div className="flex items-center justify-between mb-2 gap-2">
                                            {AssigneesAvatars}
                                            {SenderAvatar}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="flex items-center justify-between mb-2 flex-row-reverse gap-2">
                                            {AssigneesAvatars}
                                            {SenderAvatar}
                                        </div>
                                    );
                                }
                            };
                            
                            return (
                                 <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1 items-end gap-2`}>
                                    {isMe && !editingMsgId && (
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pb-1">
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
                                                    const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                    setNewChatMessage(prev => `Fwd: ${cleanText}\n` + prev);
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
                                                title="Edit"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteMessage(msg._id)}
                                                className="p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                    
                                    <div id={msg._id} className={`rounded-2xl p-1 min-w-[160px] max-w-[85%] shadow-sm relative ${
                                        isMe 
                                            ? 'bg-[#526D82] text-white rounded-br-none' 
                                            : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'
                                    }`}>
                                        <HeaderContent />

                                        {/* Reply Citation */}
                                        {msg.replyTo && (
                                            <div 
                                                onClick={() => document.getElementById(msg.replyTo._id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                                className={`mb-2 mx-1 p-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                                                    isMe 
                                                        ? 'bg-white/10 border-l-2 border-white/40 text-white/80' 
                                                        : 'bg-slate-50 border-l-2 border-slate-300 text-slate-500'
                                                }`}
                                            >
                                                <p className="font-bold opacity-75 mb-0.5">{msg.replyTo.sender?.split('@')[0]}</p>
                                                <p className="truncate line-clamp-1 italic opacity-90">{msg.replyTo.message}</p>
                                            </div>
                                        )}

                                        {editingMsgId === msg._id ? (
                                            <div className="px-1 py-1 space-y-2">
                                                <textarea 
                                                    autoFocus
                                                    className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-white/50 min-h-[60px] resize-none"
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
                                                    <button onClick={() => setEditingMsgId(null)} className="text-[9px] font-bold uppercase hover:underline">Cancel</button>
                                                    <button onClick={() => handleUpdateMessage(msg._id, editingMsgText)} className="text-[9px] font-bold uppercase hover:underline">Save</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] leading-relaxed break-words px-1">
                                                {renderMessage(msg.message)}
                                            </p>
                                        )}

                                        <div className={`flex items-center justify-between mt-1 pt-1 px-1 gap-2 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <div /> 
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] uppercase tracking-widest font-black opacity-60 shrink-0 ${isMe ? 'text-white' : 'text-slate-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleString([], { 
                                                        month: 'short', 
                                                        day: 'numeric', 
                                                        year: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit', 
                                                        hour12: true 
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isMe && !editingMsgId && (
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pb-1">
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
                                                    const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                    setNewChatMessage(prev => `Fwd: ${cleanText}\n` + prev);
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
                            );
                        })
                    )}
                </div>

                {/* Reply Indicator */}
                {replyingTo && (
                    <div className="mb-2 mx-1 p-2 bg-slate-50 border-l-4 border-blue-500 rounded flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight mb-0.5">Replying to {replyingTo.sender?.split('@')[0]}</p>
                            <p className="text-[10px] text-slate-500 truncate italic">{replyingTo.message}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors ml-2">
                            <X className="w-3 h-3 text-slate-400" />
                        </button>
                    </div>
                )}

                {/* Chat Input Area */}
                <div className="mt-3 pt-3 border-t border-slate-200/50 relative" id={`estimate-chat-input-${estimateId}`}>
                    <MyDropDown
                        isOpen={showMentions && filteredChatOptions.length > 0}
                        onClose={() => setShowMentions(false)}
                        options={filteredChatOptions}
                        selectedValues={chatAssignees}
                        onSelect={(val: any) => {
                            if (!chatAssignees.includes(val)) {
                                setChatAssignees(prev => [...prev, val]);
                            } else {
                                setChatAssignees(prev => prev.filter(v => v !== val));
                            }
                            
                            // Remove trigger text
                            const text = newChatMessage;
                            const before = text.slice(0, cursorPosition);
                            const lastAt = before.lastIndexOf('@');
                            if (lastAt >= 0) {
                                const newText = before.slice(0, lastAt) + text.slice(cursorPosition);
                                setNewChatMessage(newText);
                                
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
                        anchorId={`estimate-chat-input-${estimateId}`}
                        width="w-64"
                        showSearch={false}
                        transparentBackdrop={true}
                        modal={false}
                    />
                    
                    <form 
                        onSubmit={handleSendChatMessage} 
                        className="flex flex-col gap-2"
                    >
                        {chatAssignees.length > 0 && (
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Assigning:</span>
                                <div className="flex -space-x-1.5 overflow-hidden">
                                    {chatAssignees.map((val: string, i: number) => {
                                        const emp = employeeOptions.find(e => e.value === val || e.id === val);
                                        return (
                                            <div 
                                                key={i} 
                                                className="cursor-pointer hover:scale-110 transition-transform"
                                                onClick={() => setChatAssignees(prev => prev.filter(v => v !== val))}
                                                title={emp?.label || val}
                                            >
                                                <Avatar className="w-5 h-5 border border-white shrink-0 shadow-sm">
                                                    <AvatarImage src={emp?.profilePicture} />
                                                    <AvatarFallback className="text-[8px] bg-slate-200">
                                                        {(emp?.label || val)[0].toUpperCase()}
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
                                    Clear
                                </button>
                            </div>
                        )}
                    
                        <div className="flex items-end gap-2">
                            <div className="relative flex-1">
                                <textarea 
                                    ref={chatInputRef}
                                    placeholder="Message team... (@ to mention)"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-slate-200 focus:bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 resize-none min-h-[42px] max-h-32 overflow-y-auto"
                                    rows={1}
                                    value={newChatMessage}
                                    onInput={(e: any) => {
                                        const target = e.target;
                                        target.style.height = 'auto';
                                        target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                    }}
                                    onChange={(e: any) => handleChatInput(e)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendChatMessage();
                                        }
                                    }}
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={!newChatMessage.trim()}
                                className="w-10 h-10 bg-[#526D82] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md shrink-0 mb-0.5"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        </TooltipProvider>
    );
};
