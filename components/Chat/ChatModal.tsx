'use client';

import React, { useState, useEffect } from 'react';
import {
    X, Search, MessageCircle, Hash, Briefcase,
    User, Send, Paperclip, Image as ImageIcon,
    FileText, Video, AtSign
} from 'lucide-react';
const HashIcon = Hash;


interface SidebarData {
    estimates: any[];
    channels: any[];
    employees: any[];
}

export default function ChatModal({ onClose }: { onClose: () => void }) {

    const [sidebarData, setSidebarData] = useState<SidebarData>({ estimates: [], channels: [], employees: [] });
    const [selectedChat, setSelectedChat] = useState<{ type: 'proposal' | 'channel' | 'direct', id: string, name: string } | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/communication?action=getSidebarData');
                const data = await res.json();
                if (data.success) {
                    setSidebarData(data.result);
                }
            } catch (err) {
                console.error('Error fetching sidebar data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedChat) {
            const fetchMessages = async () => {
                try {
                    const res = await fetch(`/api/communication?action=getMessages&type=${selectedChat.type}&targetId=${selectedChat.id}`);
                    const data = await res.json();
                    if (data.success) {
                        setMessages(data.result);
                    }
                } catch (err) {
                    console.error('Error fetching messages:', err);
                }
            };
            fetchMessages();
        }
    }, [selectedChat]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedChat) return;

        const email = localStorage.getItem('user_email') || 'system@devcocrm.com';

        const payload = {
            senderId: email,
            text: inputText,
            type: selectedChat.type,
            targetId: selectedChat.id,
            attachments: [],
            mentions: []
        };

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
            }
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-6xl h-[85vh] bg-white rounded-2xl shadow-2xl flex overflow-hidden border border-gray-100 flex-col md:flex-row">

                {/* Sidebar */}
                <div className="w-full md:w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Communication</h2>
                            <button onClick={onClose} className="md:hidden text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {/* Proposals Section */}
                        <section>
                            <div className="flex items-center space-x-2 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <Briefcase size={14} />
                                <span>Proposals</span>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {sidebarData.estimates.filter(est =>
                                    (est.estimate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (est.projectName || '').toLowerCase().includes(searchQuery.toLowerCase())
                                ).map(est => (
                                    <button
                                        key={est._id}
                                        onClick={() => setSelectedChat({ type: 'proposal', id: est.estimate, name: `Prop: ${est.estimate}` })}
                                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${selectedChat?.id === est.estimate ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-indigo-50 text-gray-700'}`}
                                    >
                                        <HashIcon size={16} className={selectedChat?.id === est.estimate ? 'text-indigo-200' : 'text-indigo-500'} />
                                        <div className="text-left truncate">
                                            <div className="text-sm font-semibold">{est.estimate}</div>
                                            <div className={`text-[11px] truncate ${selectedChat?.id === est.estimate ? 'text-indigo-100' : 'text-gray-500'}`}>
                                                {est.projectName || 'No Project Name'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Channels Section */}
                        <section>
                            <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center space-x-2">
                                    <Hash size={14} />
                                    <span>Channels</span>
                                </div>
                                <button
                                    onClick={async () => {
                                        const name = prompt('Enter channel name:');
                                        if (name) {
                                            try {
                                                const res = await fetch('/api/communication', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        action: 'createChannel',
                                                        payload: { name, createdBy: localStorage.getItem('user_email') || 'admin' }
                                                    })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    setSidebarData(prev => ({
                                                        ...prev,
                                                        channels: [...prev.channels, data.result].sort((a, b) => a.name.localeCompare(b.name))
                                                    }));
                                                }
                                            } catch (err) {
                                                console.error('Error creating channel:', err);
                                            }
                                        }
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                                    title="Create New Channel"
                                >
                                    <X size={14} className="rotate-45" />
                                </button>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {sidebarData.channels.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase())).map(ch => (
                                    <button
                                        key={ch._id}
                                        onClick={() => setSelectedChat({ type: 'channel', id: ch._id, name: ch.name })}
                                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${selectedChat?.id === ch._id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-indigo-50 text-gray-700'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${selectedChat?.id === ch._id ? 'bg-white' : 'bg-green-500'}`}></div>
                                        <span className="text-sm font-semibold truncate">{ch.name}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Employees Section */}
                        <section>
                            <div className="flex items-center space-x-2 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <User size={14} />
                                <span>Employees</span>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {sidebarData.employees.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(e => (
                                    <button
                                        key={e._id}
                                        onClick={() => setSelectedChat({ type: 'direct', id: e.email, name: `${e.firstName} ${e.lastName}` })}
                                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${selectedChat?.id === e.email ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-indigo-50 text-gray-700'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white">
                                            {e.firstName[0]}{e.lastName[0]}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-semibold truncate">{e.firstName} {e.lastName}</div>
                                            <div className={`text-[11px] truncate ${selectedChat?.id === e.email ? 'text-indigo-100' : 'text-gray-500'}`}>
                                                {e.email}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100">
                                        {selectedChat.type === 'proposal' ? <Briefcase size={20} /> : selectedChat.type === 'channel' ? <Hash size={20} /> : <User size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 leading-none">{selectedChat.name}</h3>
                                        <div className="text-xs text-green-500 font-medium flex items-center mt-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                                            Online
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                        <Search size={20} />
                                    </button>
                                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                                {messages.map((m, idx) => {
                                    const isMe = m.senderId === (localStorage.getItem('user_email') || 'system@devcocrm.com');
                                    return (
                                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                                {!isMe && <div className="text-[10px] font-bold text-indigo-500 mb-1 uppercase tracking-wider">{m.senderId}</div>}
                                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                                                <div className={`text-[10px] mt-2 font-medium ${isMe ? 'text-indigo-200 text-right' : 'text-gray-400'}`}>
                                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                        <MessageCircle size={64} className="mb-4 text-indigo-200" />
                                        <p className="font-medium">No messages yet. Start the conversation!</p>
                                    </div>
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="p-4 bg-white border-t border-gray-200">
                                <form onSubmit={handleSendMessage} className="flex flex-col space-y-3">
                                    <div className="flex items-center space-x-2 text-gray-400 px-1">
                                        <button type="button" className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"><ImageIcon size={18} /></button>
                                        <button type="button" className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"><FileText size={18} /></button>
                                        <button type="button" className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"><Video size={18} /></button>
                                        <button type="button" className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"><AtSign size={18} /></button>
                                        <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                                        <button type="button" className="text-xs font-bold hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-all">REF#</button>
                                    </div>
                                    <div className="flex items-end space-x-2">
                                        <textarea
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder={`Message ${selectedChat.name}...`}
                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none min-h-[44px] max-h-32"
                                            rows={1}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage(e);
                                                }
                                            }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!inputText.trim()}
                                            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-indigo-100 flex-shrink-0"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                <MessageCircle size={48} className="text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Devco Communications</h2>
                            <p className="text-gray-500 text-center max-w-sm">
                                Select a Proposal, Channel, or Colleague from the sidebar to start chatting.
                            </p>
                            <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-md">
                                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                                    <HashIcon className="text-indigo-500 mb-2" size={24} />
                                    <span className="text-xs font-bold text-gray-700">Tag Estimates</span>
                                </div>
                                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                                    <AtSign className="text-indigo-500 mb-2" size={24} />
                                    <span className="text-xs font-bold text-gray-700">Mention Team</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// export default ChatModal; (moved to function definition)

