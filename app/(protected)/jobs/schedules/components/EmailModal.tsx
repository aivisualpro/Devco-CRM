import React from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    emailTo: string;
    setEmailTo: (email: string) => void;
    handleEmailConfirm: (e: React.FormEvent) => void;
    isSending: boolean;
    title?: string;
}

export const EmailModal = ({
    isOpen,
    onClose,
    emailTo,
    setEmailTo,
    handleEmailConfirm,
    isSending,
    title = "Email Document"
}: EmailModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="md"
        >
            <form onSubmit={handleEmailConfirm} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                        <Mail size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                        <p className="text-xs text-blue-800/70 mt-1">The document will be attached as a PDF and sent to the recipient below.</p>
                    </div>
                </div>
                
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Recipient Email</label>
                    <input 
                        type="email"
                        required
                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                        placeholder="Enter email address"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSending}
                        className="px-6 py-2 bg-[#0F4C75] text-white text-sm font-bold rounded-lg hover:bg-[#0b3d61] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                        Send Email
                    </button>
                </div>
            </form>
        </Modal>
    );
};
