'use client';

import { Header } from '@/components/ui';
import { FileText, Clock } from 'lucide-react';

export default function PreBoreLogsPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />

            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
                        <FileText size={36} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-3">Pre-Bore Logs</h1>
                    <p className="text-slate-500 text-lg mb-6">
                        This feature is coming soon. The schema for Pre-Bore Logs is pending.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-full text-sm font-medium">
                        <Clock size={16} />
                        Schema Pending
                    </div>
                </div>
            </div>
        </div>
    );
}
