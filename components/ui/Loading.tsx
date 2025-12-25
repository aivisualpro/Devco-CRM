'use client';

import React from 'react';

interface LoadingProps {
    text?: string;
}

export function Loading({ text = '' }: LoadingProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 min-h-[300px]">
            <div className="relative flex flex-col items-center">
                {/* Dynamic Radial Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-radial from-[#0F4C75]/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
                
                {/* Logo with Multi-Layered Animation */}
                <div className="relative">
                    {/* Ghosting Effect */}
                    <img 
                        src="/logo-loader.png" 
                        alt="" 
                        className="absolute inset-0 w-56 h-56 object-contain opacity-20 blur-sm scale-110 animate-logo-ghost"
                    />
                    
                    {/* Main Logo */}
                    <div className="relative animate-logo-float">
                        <img 
                            src="/logo-loader.png" 
                            alt="Loading..." 
                            className="w-56 h-56 object-contain drop-shadow-[0_20px_35px_rgba(15,76,117,0.4)]"
                        />
                        {/* Shimmer Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shimmer-effect mix-blend-overlay"></div>
                    </div>
                </div>

                {/* Mechanical Progress Bar */}
                <div className="mt-12 w-64">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden neu-pressed p-[2px]">
                        <div className="h-full bg-gradient-to-r from-[#0F4C75] via-[#3282B8] to-[#0F4C75] animate-progress-loading rounded-full relative">
                            <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                        </div>
                    </div>
                    {text && (
                        <div className="mt-6 flex flex-col items-center gap-2">
                            <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.5em] animate-pulse whitespace-nowrap">
                                {text}
                            </p>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-[#0F4C75] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-[#0F4C75] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-[#0F4C75] rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
                    50% { transform: translateY(-20px) scale(1.02) rotate(1deg); }
                }
                @keyframes ghost {
                    0%, 100% { transform: scale(1.1) translateY(0); opacity: 0.1; }
                    50% { transform: scale(1.3) translateY(-10px); opacity: 0.3; }
                }
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0); }
                    100% { transform: translateX(100%); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-logo-float {
                    animation: float 3.5s ease-in-out infinite;
                }
                .animate-logo-ghost {
                    animation: ghost 3.5s ease-in-out infinite;
                }
                .animate-progress-loading {
                    width: 100%;
                    animation: progress 2.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
                }
                .animate-shimmer {
                    animation: shimmer 1.5s linear infinite;
                }
                .shimmer-effect {
                    animation: shimmer 2s infinite;
                    mask-image: linear-gradient(to right, transparent, black, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black, transparent);
                }
                .neu-pressed {
                    box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1), inset -2px -2px 4px rgba(255,255,255,0.7);
                }
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}

interface EmptyStateProps {
    icon?: string;
    title: string;
    message: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon = '📦', title, message, action }: EmptyStateProps) {
    return (
        <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{message}</p>
            {action}
        </div>
    );
}

export default Loading;
