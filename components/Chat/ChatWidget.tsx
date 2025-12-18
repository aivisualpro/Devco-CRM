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
                className="fixed bottom-6 right-6 w-16 h-16 text-white shadow-2xl transition-all duration-500 flex items-center justify-center z-50 group hover:scale-110 active:scale-95 animate-pulse-glow"
                style={{
                    backgroundColor: '#0066FF',
                    borderRadius: '24px', // Squircle effect
                }}
                title="Open Devco Communication"
            >
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
                        {/* Chat Persona Body */}
                        <path
                            d="M25,55 C25,30 40,20 55,20 C75,20 85,35 85,55 C85,75 70,85 55,85 C50,85 45,84 40,84 L25,92 L29,78 C25,72 25,65 25,55 Z"
                            fill="white"
                            stroke="#0f172a"
                            strokeWidth="6"
                            strokeLinejoin="round"
                        />
                        {/* Eyes with blinking animation */}
                        <g className="animate-[bounce_3s_infinite]">
                            <ellipse cx="48" cy="48" rx="5" ry="7" fill="#0f172a" transform="rotate(-10 48 48)" />
                            <ellipse cx="68" cy="48" rx="5" ry="7" fill="#0f172a" transform="rotate(10 68 48)" />
                        </g>
                    </svg>
                </div>
            </button>

            {isOpen && <ChatModal onClose={() => setIsOpen(false)} />}
        </>
    );
};

export default ChatWidget;
