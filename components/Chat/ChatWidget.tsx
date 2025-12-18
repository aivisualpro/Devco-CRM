'use client';

import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatModal from './ChatModal';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center z-50 group scale-100 hover:scale-110 active:scale-95"
                title="Open Devco Communication"
            >
                <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>

            {isOpen && <ChatModal onClose={() => setIsOpen(false)} />}
        </>
    );
};

export default ChatWidget;
