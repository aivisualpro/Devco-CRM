'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    X, Search, MessageCircle, Hash, Briefcase,
    User, Send, Image as ImageIcon,
    FileText, AtSign, Loader2, Reply, CornerUpRight, MoreHorizontal, CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import Pusher from 'pusher-js';

// Color palette for sender names
const SENDER_COLORS = [
    '#0F4C75', '#059669', '#7c3aed', '#dc2626', '#ea580c', '#0891b2', '#c026d3', '#4f46e5'
];

const getSenderColor = (senderId: string) => {
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
        hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

interface SidebarData {
    estimates: any[];
    channels: any[];
    employees: any[];
}

interface Attachment {
    name: string;
    url: string;
    type: string;
    size: number;
}

interface ReplyInfo {
    messageId: string;
    senderName: string;
    text: string;
}

export default function ChatModal({ onClose }: { onClose: () => void }) {
    const [sidebarData, setSidebarData] = useState<SidebarData>({ estimates: [], channels: [], employees: [] });
    const [selectedChat, setSelectedChat] = useState<{ type: 'proposal' | 'channel' | 'direct', id: string, name: string } | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);
    const [showMentionPopover, setShowMentionPopover] = useState(false);
    const [showRefPopover, setShowRefPopover] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [refFilter, setRefFilter] = useState('');
    const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const myEmail = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email || 'system@devcocrm.com' 
        : 'system@devcocrm.com';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/communication?action=getSidebarData');
                const data = await res.json();
                if (data.success) setSidebarData(data.result);
            } catch (err) {
                console.error('Error fetching sidebar data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (selectedChat) {
            const fetchMessages = async () => {
                try {
                    const res = await fetch(`/api/communication?action=getMessages&type=${selectedChat.type}&targetId=${selectedChat.id}`);
                    const data = await res.json();
                    if (data.success) setMessages(data.result);
                } catch (err) {
                    console.error('Error fetching messages:', err);
                }
            };
            fetchMessages();

            const isDev = process.env.NODE_ENV === 'development';
            const pusherKey = isDev ? process.env.NEXT_PUBLIC_DEV_PUSHER_KEY : process.env.NEXT_PUBLIC_PUSHER_KEY;
            const pusherCluster = isDev ? process.env.NEXT_PUBLIC_DEV_PUSHER_CLUSTER : process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

            if (pusherKey && pusherCluster) {
                const pusher = new Pusher(pusherKey, { cluster: pusherCluster });
                const channel = pusher.subscribe(`${selectedChat.type}-${selectedChat.id}`);
                channel.bind('new-message', (newMessage: any) => {
                    setMessages((prev) => {
                        if (prev.find(m => m._id === newMessage._id)) return prev;
                        return [...prev, newMessage];
                    });
                });
                return () => pusher.unsubscribe(`${selectedChat.type}-${selectedChat.id}`);
            }
        }
    }, [selectedChat]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputText(value);
        const cursorPos = e.target.selectionStart || 0;
        const textUpToCursor = value.substring(0, cursorPos);
        
        const atMatch = textUpToCursor.match(/@(\w*)$/);
        if (atMatch) { setMentionFilter(atMatch[1]); setShowMentionPopover(true); setShowRefPopover(false); }
        else setShowMentionPopover(false);
        
        const hashMatch = textUpToCursor.match(/#(\w*)$/);
        if (hashMatch) { setRefFilter(hashMatch[1]); setShowRefPopover(true); setShowMentionPopover(false); }
        else setShowRefPopover(false);
    };

    const insertMention = (employee: any) => {
        const name = `${employee.firstName} ${employee.lastName}`;
        setInputText(inputText.replace(/@\w*$/, `@${name} `));
        setShowMentionPopover(false);
        inputRef.current?.focus();
    };

    const insertReference = (estimate: any) => {
        setInputText(inputText.replace(/#\w*$/, `#${estimate.estimate} `));
        setShowRefPopover(false);
        inputRef.current?.focus();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        const newAttachments: Attachment[] = [];
        
        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'chat-attachments');
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success && data.url) {
                    newAttachments.push({ name: file.name, url: data.url, type: file.type, size: file.size });
                }
            } catch (err) { 
                console.error('Upload error:', err);
                toast.error('File upload failed');
            }
        }
        
        setAttachments(prev => [...prev, ...newAttachments]);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && attachments.length === 0) || !selectedChat) return;

        const mentionMatches = inputText.match(/@([\w\s]+?)(?=\s|$|@|#)/g) || [];
        const payload: any = {
            senderId: myEmail,
            text: inputText,
            type: selectedChat.type,
            targetId: selectedChat.id,
            attachments,
            mentions: mentionMatches.map(m => m.replace('@', '').trim())
        };
        if (replyTo) payload.replyTo = replyTo;

        try {
            const res = await fetch('/api/communication', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sendMessage', payload })
            });
            const data = await res.json();
            if (data.success) {
                setMessages([...messages, data.result]);
                setInputText('');
                setAttachments([]);
                setReplyTo(null);
            }
        } catch (err) { 
            console.error('Error sending message:', err);
            toast.error('Failed to send message');
        }
    };

    const handleReply = (message: any, senderName: string) => {
        setReplyTo({ messageId: message._id, senderName, text: message.text?.substring(0, 100) || '[Attachment]' });
        inputRef.current?.focus();
    };

    const handleForward = async (message: any) => {
        const targetChat = prompt('Enter proposal number or channel name to forward to:');
        if (!targetChat) return;
        const targetEstimate = sidebarData.estimates.find(e => e.estimate === targetChat);
        const targetChannel = sidebarData.channels.find(c => c.name.toLowerCase() === targetChat.toLowerCase());
        if (!targetEstimate && !targetChannel) { toast.error('Target not found'); return; }

        try {
            await fetch('/api/communication', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sendMessage', payload: {
                    senderId: myEmail,
                    text: `[Forwarded]\n${message.text || ''}`,
                    type: targetEstimate ? 'proposal' : 'channel',
                    targetId: targetEstimate ? targetEstimate.estimate : targetChannel._id,
                    attachments: message.attachments || [],
                    mentions: [],
                    forwardedFrom: message.senderId
                }})
            });
            toast.success(`Message forwarded to ${targetChat}`);
        } catch (err) { 
            console.error('Forward error:', err);
            toast.error('Failed to forward message');
        }
    };

    const filteredEmployees = sidebarData.employees.filter(e => 
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(mentionFilter.toLowerCase())
    ).slice(0, 5);

    const filteredEstimates = sidebarData.estimates.filter(e => 
        (e.estimate || '').toLowerCase().includes(refFilter.toLowerCase()) ||
        (e.projectName || '').toLowerCase().includes(refFilter.toLowerCase())
    ).slice(0, 5);

    const renderMessageText = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(@[\w\s]+|#[\w-]+)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('@')) return <span key={idx} className="text-[#0F4C75] font-semibold">{part}</span>;
            if (part.startsWith('#')) return <span key={idx} className="text-[#3282B8] font-semibold cursor-pointer hover:underline">{part}</span>;
            return part;
        });
    };

    const getEmployeeInfo = (email: string) => {
        const emp = sidebarData.employees.find(e => e.email?.toLowerCase() === email?.toLowerCase());
        if (emp) return { name: `${emp.firstName} ${emp.lastName}`, initials: `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`, image: emp.profilePicture || null };
        return { name: email?.split('@')[0] || 'Unknown', initials: email?.substring(0, 2).toUpperCase() || '??', image: null };
    };

    const isImageAttachment = (att: Attachment) => {
        if (att.type?.startsWith('image/')) return true;
        const url = att.url?.toLowerCase() || '';
        return url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.gif') || url.endsWith('.webp');
    };

    const formatTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-6xl h-[85vh] bg-white rounded-2xl shadow-2xl flex overflow-hidden flex-col md:flex-row">
                
                {/* Left Sidebar */}
                <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full">
                    <div className="p-5 border-b border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-800">Messages</h2>
                            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><MoreHorizontal size={20} /></button>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <button className="px-4 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-full">All</button>
                            <button className="px-4 py-1.5 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-100">Unread</button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Proposals */}
                        <div className="px-3 py-2">
                            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                <Briefcase size={12} /><span>Proposals</span>
                            </div>
                            {sidebarData.estimates.filter(est => (est.estimate || '').toLowerCase().includes(searchQuery.toLowerCase()) || (est.projectName || '').toLowerCase().includes(searchQuery.toLowerCase())).map(est => (
                                <button key={est._id} onClick={() => setSelectedChat({ type: 'proposal', id: est.estimate, name: est.estimate })}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${selectedChat?.id === est.estimate ? 'bg-[#0F4C75] text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedChat?.id === est.estimate ? 'bg-white/20' : 'bg-[#0F4C75]/10 text-[#0F4C75]'}`}>
                                        <Hash size={18} />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="font-semibold text-sm">{est.estimate}</div>
                                        <div className={`text-xs truncate ${selectedChat?.id === est.estimate ? 'text-white/70' : 'text-slate-500'}`}>{est.projectName || 'No Project Name'}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Channels */}
                        <div className="px-3 py-2">
                            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                <MessageCircle size={12} /><span>Channels</span>
                            </div>
                            {sidebarData.channels.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase())).map(ch => (
                                <button key={ch._id} onClick={() => setSelectedChat({ type: 'channel', id: ch._id, name: ch.name })}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${selectedChat?.id === ch._id ? 'bg-[#0F4C75] text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedChat?.id === ch._id ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <Hash size={18} />
                                    </div>
                                    <div className="text-left flex-1"><div className="font-semibold text-sm">{ch.name}</div></div>
                                </button>
                            ))}
                        </div>

                        {/* Team */}
                        <div className="px-3 py-2">
                            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                <User size={12} /><span>Team</span>
                            </div>
                            {sidebarData.employees.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(e => (
                                <button key={e._id} onClick={() => setSelectedChat({ type: 'direct', id: e.email, name: `${e.firstName} ${e.lastName}` })}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${selectedChat?.id === e.email ? 'bg-[#0F4C75] text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm overflow-hidden ${selectedChat?.id === e.email ? 'bg-white/20' : 'bg-slate-200'}`}>
                                            {e.profilePicture ? <img src={e.profilePicture} alt="" className="w-full h-full object-cover" /> : <span>{e.firstName?.[0]}{e.lastName?.[0]}</span>}
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="font-semibold text-sm">{e.firstName} {e.lastName}</div>
                                        <div className={`text-xs truncate ${selectedChat?.id === e.email ? 'text-white/70' : 'text-slate-500'}`}>{e.email}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-50 relative">
                    {selectedChat ? (
                        <>
                            {/* Header */}
                            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-full bg-[#0F4C75] flex items-center justify-center text-white overflow-hidden">
                                        {selectedChat.type === 'direct' ? (getEmployeeInfo(selectedChat.id).image ? <img src={getEmployeeInfo(selectedChat.id).image!} alt="" className="w-full h-full object-cover" /> : <span className="font-semibold">{getEmployeeInfo(selectedChat.id).initials}</span>) : <Hash size={22} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{selectedChat.name}</h3>
                                        <p className="text-xs text-emerald-500 font-medium">Online</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Search size={18} /></button>
                                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X size={18} /></button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {messages.length > 0 && (
                                    <div className="flex justify-center mb-6">
                                        <span className="text-[11px] font-medium text-slate-400 bg-white px-4 py-1.5 rounded-full shadow-sm">TODAY</span>
                                    </div>
                                )}
                                
                                {messages.map((m, idx) => {
                                    const isMe = m.senderId === myEmail;
                                    const senderInfo = getEmployeeInfo(m.senderId);
                                    const senderColor = getSenderColor(m.senderId || '');
                                    const isHovered = hoveredMessage === m._id;

                                    return (
                                        <div key={m._id || idx} className={`flex gap-3 mb-4 ${isMe ? 'flex-row-reverse' : ''}`}
                                            onMouseEnter={() => setHoveredMessage(m._id)} onMouseLeave={() => setHoveredMessage(null)}>
                                            <div className="flex-shrink-0">
                                                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold overflow-hidden">
                                                    {senderInfo.image ? <img src={senderInfo.image} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-600">{senderInfo.initials}</span>}
                                                </div>
                                            </div>
                                            
                                            <div className={`max-w-[65%]`}>
                                                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                    <span className="text-sm font-semibold" style={{ color: senderColor }}>{senderInfo.name}</span>
                                                    <span className="text-[11px] text-slate-400">{formatTime(m.createdAt)}</span>
                                                </div>
                                                
                                                <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${isMe ? 'bg-[#d4edda] text-slate-800 rounded-tr-md' : 'bg-white text-slate-800 rounded-tl-md border border-slate-100'}`}>
                                                    {m.replyTo && (
                                                        <div className="mb-2 p-2 bg-black/5 rounded-lg border-l-3 border-[#0F4C75]">
                                                            <div className="text-xs font-semibold text-[#0F4C75]">{m.replyTo.senderName}</div>
                                                            <div className="text-xs text-slate-500 truncate">{m.replyTo.text}</div>
                                                        </div>
                                                    )}
                                                    
                                                    {m.attachments?.filter((a: Attachment) => isImageAttachment(a)).length > 0 && (
                                                        <div className="mb-2 -mx-4 -mt-3">
                                                            {m.attachments.filter((a: Attachment) => isImageAttachment(a)).map((att: Attachment, attIdx: number) => (
                                                                <a key={attIdx} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                                                    <img src={att.url} alt={att.name || 'Image'} className={`w-full max-h-72 object-cover ${attIdx === 0 && !m.replyTo ? (isMe ? 'rounded-t-2xl rounded-tr-md' : 'rounded-t-2xl rounded-tl-md') : 'rounded-lg mt-2'}`} />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {m.text && <div className="text-[14px] leading-relaxed">{renderMessageText(m.text)}</div>}
                                                    
                                                    {m.attachments?.filter((a: Attachment) => !isImageAttachment(a)).length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {m.attachments.filter((a: Attachment) => !isImageAttachment(a)).map((att: Attachment, attIdx: number) => (
                                                                <a key={attIdx} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/5 rounded-lg text-xs hover:bg-black/10">
                                                                    <FileText size={14} className="text-slate-500" /><span className="truncate">{att.name || 'File'}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {isMe && <div className="flex justify-end mt-1"><CheckCheck size={14} className="text-[#0F4C75]" /></div>}
                                                </div>
                                                
                                                {isHovered && (
                                                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                                                        <button onClick={() => handleReply(m, senderInfo.name)} className="p-1.5 hover:bg-slate-200 rounded-full"><Reply size={14} className="text-slate-500" /></button>
                                                        <button onClick={() => handleForward(m)} className="p-1.5 hover:bg-slate-200 rounded-full"><CornerUpRight size={14} className="text-slate-500" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />

                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <div className="w-20 h-20 rounded-full bg-[#0F4C75]/10 flex items-center justify-center mb-4"><MessageCircle size={40} className="text-[#0F4C75]" /></div>
                                        <p className="text-slate-500 font-medium">No messages yet</p>
                                        <p className="text-slate-400 text-sm">Start the conversation!</p>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="px-6 py-4 bg-white border-t border-slate-100">
                                {replyTo && (
                                    <div className="mb-3 p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-10 bg-[#0F4C75] rounded-full"></div>
                                            <div>
                                                <div className="text-xs font-semibold text-[#0F4C75]">{replyTo.senderName}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[300px]">{replyTo.text}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-slate-200 rounded-full"><X size={16} className="text-slate-400" /></button>
                                    </div>
                                )}

                                {showMentionPopover && filteredEmployees.length > 0 && (
                                    <div className="absolute bottom-full left-6 right-6 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50">
                                        <div className="p-2 border-b border-slate-100"><span className="text-xs font-bold text-slate-400">Mention someone</span></div>
                                        {filteredEmployees.map(emp => (
                                            <button key={emp._id} onClick={() => insertMention(emp)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50">
                                                <div className="w-8 h-8 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                                                    {emp.profilePicture ? <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName?.[0]}{emp.lastName?.[0]}</>}
                                                </div>
                                                <div className="text-left"><div className="text-sm font-semibold text-slate-700">{emp.firstName} {emp.lastName}</div></div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {showRefPopover && filteredEstimates.length > 0 && (
                                    <div className="absolute bottom-full left-6 right-6 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-50">
                                        <div className="p-2 border-b border-slate-100"><span className="text-xs font-bold text-slate-400">Reference a proposal</span></div>
                                        {filteredEstimates.map(est => (
                                            <button key={est._id} onClick={() => insertReference(est)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50">
                                                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Hash size={16} /></div>
                                                <div className="text-left">
                                                    <div className="text-sm font-semibold text-slate-700">{est.estimate}</div>
                                                    <div className="text-xs text-slate-500">{est.projectName || 'No project name'}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {attachments.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {attachments.map((att, idx) => (
                                            <div key={idx} className="relative group">
                                                {isImageAttachment(att) ? (
                                                    <div className="relative">
                                                        <img src={att.url} alt="" className="w-16 h-16 object-cover rounded-xl" />
                                                        <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={12} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-sm">
                                                        <FileText size={14} /><span className="truncate max-w-[100px]">{att.name}</span>
                                                        <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                                    <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-3 hover:bg-slate-100 rounded-xl text-slate-500 disabled:opacity-50">
                                        {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                                    </button>
                                    <div className="flex-1">
                                        <textarea ref={inputRef} value={inputText} onChange={handleInputChange} placeholder="Type a message..."
                                            className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 resize-none max-h-32" rows={1}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } if (e.key === 'Escape') { setShowMentionPopover(false); setShowRefPopover(false); setReplyTo(null); } }} />
                                    </div>
                                    <button type="button" onClick={() => { setInputText(prev => prev + '@'); setShowMentionPopover(true); inputRef.current?.focus(); }} className="p-3 hover:bg-slate-100 rounded-xl text-slate-500"><AtSign size={20} /></button>
                                    <button type="submit" disabled={!inputText.trim() && attachments.length === 0} className="px-5 py-3 bg-[#0F4C75] text-white rounded-xl font-medium flex items-center gap-2 hover:bg-[#0a3a5c] disabled:opacity-50 disabled:bg-slate-300 shadow-lg shadow-[#0F4C75]/20">
                                        <Send size={18} /><span className="hidden sm:inline">Send</span>
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="w-24 h-24 rounded-full bg-[#0F4C75]/10 flex items-center justify-center mb-6"><MessageCircle size={48} className="text-[#0F4C75]" /></div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to DEVCO Chat</h2>
                            <p className="text-slate-500 text-center max-w-sm">Select a conversation from the sidebar to start messaging</p>
                            <div className="flex gap-4 mt-8">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl"><Hash className="text-[#0F4C75]" size={18} /><span className="text-sm font-medium text-slate-600">Type # to tag proposals</span></div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl"><AtSign className="text-[#0F4C75]" size={18} /><span className="text-sm font-medium text-slate-600">Type @ to mention</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
