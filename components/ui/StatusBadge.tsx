import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
    status: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'in-progress' | 'completed' | string;
    variant?: 'solid' | 'outline' | 'soft';
    className?: string;
}

export function StatusBadge({ status, variant = 'soft', className = '' }: StatusBadgeProps) {
    const normalizedStatus = (status || '').toLowerCase();

    // Mapping colors and icons
    let colorClass = '';
    let icon = null;

    switch (normalizedStatus) {
        case 'active':
        case 'approved':
        case 'completed':
            colorClass = variant === 'soft' ? 'bg-green-50 text-green-700 border-green-200' 
                       : variant === 'solid' ? 'bg-green-600 text-white border-green-600'
                       : 'border-green-500 text-green-600';
            icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1" />;
            break;
        case 'inactive':
        case 'rejected':
            colorClass = variant === 'soft' ? 'bg-rose-50 text-rose-700 border-rose-200' 
                       : variant === 'solid' ? 'bg-rose-600 text-white border-rose-600'
                       : 'border-rose-500 text-rose-600';
            icon = <XCircle className="w-3.5 h-3.5 mr-1" />;
            break;
        case 'pending':
            colorClass = variant === 'soft' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                       : variant === 'solid' ? 'bg-amber-500 text-white border-amber-500'
                       : 'border-amber-500 text-amber-600';
            icon = <Clock className="w-3.5 h-3.5 mr-1" />;
            break;
        case 'in-progress':
            colorClass = variant === 'soft' ? 'bg-blue-50 text-blue-700 border-blue-200' 
                       : variant === 'solid' ? 'bg-blue-600 text-white border-blue-600'
                       : 'border-blue-500 text-blue-600';
            icon = <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />;
            break;
        default:
            colorClass = variant === 'soft' ? 'bg-slate-100 text-slate-700 border-slate-200' 
                       : variant === 'solid' ? 'bg-slate-600 text-white border-slate-600'
                       : 'border-slate-500 text-slate-600';
            icon = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
            break;
    }

    const baseClass = variant === 'outline' ? 'border bg-transparent' : variant === 'solid' ? 'border' : 'border';

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${baseClass} ${colorClass} ${className}`}>
            {icon}
            {status}
        </span>
    );
}
