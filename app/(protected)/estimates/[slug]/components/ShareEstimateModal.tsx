'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Copy, Check, Mail, QrCode, Share2, ExternalLink, Loader2,
    Sparkles, Link2, MessageSquare, Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ShareEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    estimateId: string;
    estimateNumber: string;
    projectName?: string;
    customerName?: string;
    customerEmail?: string;
}

export function ShareEstimateModal({
    isOpen,
    onClose,
    estimateId,
    estimateNumber,
    projectName,
    customerName,
    customerEmail
}: ShareEstimateModalProps) {
    const [shareLink, setShareLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [emailTo, setEmailTo] = useState(customerEmail || '');
    const [emailSending, setEmailSending] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isOpen && !shareLink) {
            generateShareLink();
        }
        if (isOpen && customerEmail) {
            setEmailTo(customerEmail);
        }
    }, [isOpen]);

    useEffect(() => {
        if (shareLink && qrCanvasRef.current) {
            generateQRCode(shareLink);
        }
    }, [shareLink]);

    const generateShareLink = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/estimate-form?estimateId=${estimateId}`);
            const data = await res.json();

            if (data.success && data.token) {
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/estimate-form/${data.token}`;
                setShareLink(link);
            } else {
                toast.error('Failed to generate share link');
            }
        } catch (err) {
            toast.error('Error generating share link');
        } finally {
            setLoading(false);
        }
    };

    // Simple QR code generator using canvas (no external dependency)
    const generateQRCode = (text: string) => {
        const canvas = qrCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use the QR code library loaded via script or generate a simple pattern
        // For a clean solution, we'll use a simple approach with data URL
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        // Create QR code image via Google Charts API
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, 0, 0, size, size);
        };
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0F4C75&margin=10`;
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleEmailShare = () => {
        if (!emailTo) {
            toast.error('Please enter an email address');
            return;
        }

        const subject = encodeURIComponent(`Project Details Required - ${estimateNumber}${projectName ? ` | ${projectName}` : ''}`);
        const body = encodeURIComponent(
            `Hello${customerName ? ` ${customerName}` : ''},\n\n` +
            `We'd like to collect some project details for Estimate #${estimateNumber}${projectName ? ` (${projectName})` : ''}.\n\n` +
            `Please fill out the form using the link below:\n\n` +
            `${shareLink}\n\n` +
            `Thank you for your cooperation.\n\n` +
            `Best regards,\nDEVCO Team`
        );

        window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`, '_blank');
        toast.success('Email client opened!');
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Project Details - ${estimateNumber}`,
                    text: `Please fill out the project details form for Estimate #${estimateNumber}`,
                    url: shareLink,
                });
            } catch (err) {
                // User cancelled share
            }
        } else {
            handleCopy();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0F4C75] via-[#1A5980] to-[#0D3D5F]" />
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                            backgroundSize: '20px 20px'
                        }} />
                    </div>
                    <div className="relative px-8 py-6 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                    <Share2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">Share Form</h2>
                                    <p className="text-blue-200 text-xs mt-0.5">
                                        Estimate #{estimateNumber}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="relative w-16 h-16 mb-4">
                                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium">Generating share link...</p>
                        </div>
                    ) : (
                        <>
                            {/* QR Code */}
                            <div className="flex flex-col items-center">
                                <div className="relative p-4 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 mb-4">
                                    <canvas
                                        ref={qrCanvasRef}
                                        className="rounded-xl"
                                        style={{ width: 180, height: 180 }}
                                    />
                                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#0F4C75] to-[#1A5980] rounded-lg flex items-center justify-center shadow-lg">
                                        <QrCode className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Scan to open form
                                </p>
                            </div>

                            {/* Share Link */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                                    <Link2 className="w-3 h-3" />
                                    Shareable Link
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 truncate select-all cursor-text">
                                        {shareLink}
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${copied
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-[#0F4C75] text-white hover:bg-[#0D3D5F] shadow-lg shadow-blue-500/20'
                                            }`}
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowEmailForm(!showEmailForm)}
                                    className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm transition-all border ${showEmailForm
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-lg shadow-blue-100/50'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                        }`}
                                >
                                    <Mail className="w-4 h-4" />
                                    Email
                                </button>
                                <button
                                    onClick={handleNativeShare}
                                    className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Share
                                </button>
                            </div>

                            {/* Email Form */}
                            {showEmailForm && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest px-1 flex items-center gap-1.5">
                                        <Mail className="w-3 h-3" />
                                        Send via Email
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            value={emailTo}
                                            onChange={(e) => setEmailTo(e.target.value)}
                                            placeholder="customer@email.com"
                                            className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        />
                                        <button
                                            onClick={handleEmailShare}
                                            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
                                        >
                                            <Send className="w-4 h-4" />
                                            Send
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Open in New Tab */}
                            <button
                                onClick={() => window.open(shareLink, '_blank')}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition-all"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Preview Form in New Tab
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span className="font-bold">
                            This link allows your customer to fill in project details without logging in.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
