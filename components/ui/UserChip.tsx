import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface UserChipProps {
    user: {
        email?: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
        profilePicture?: string;
        name?: string;
    };
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function UserChip({ user, size = 'md', className = '' }: UserChipProps) {
    if (!user) return null;

    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const displayName = user.name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : user.email || 'Unknown User');
    const initials = firstName && lastName ? `${firstName[0]}${lastName[0]}` : displayName.substring(0, 2).toUpperCase();
    const avatarUrl = user.avatar || user.profilePicture;

    const sizeClasses = {
        sm: {
            container: 'gap-1.5 px-2 py-1',
            avatar: 'w-5 h-5 text-[9px]',
            text: 'text-[11px]'
        },
        md: {
            container: 'gap-2 px-3 py-1.5',
            avatar: 'w-6 h-6 text-[10px]',
            text: 'text-xs'
        },
        lg: {
            container: 'gap-2.5 px-4 py-2',
            avatar: 'w-8 h-8 text-xs',
            text: 'text-sm'
        }
    };

    const s = sizeClasses[size];

    return (
        <div className={`inline-flex items-center rounded-full bg-slate-50 border border-slate-200 transition-colors hover:bg-slate-100 ${s.container} ${className}`}>
            {avatarUrl ? (
                <img 
                    src={avatarUrl} 
                    alt={displayName} 
                    className={`${s.avatar} rounded-full object-cover shadow-sm bg-white border border-slate-200`}
                />
            ) : (
                <div className={`${s.avatar} rounded-full bg-[#0F4C75] text-white flex items-center justify-center font-bold shadow-sm`}>
                    {initials || <UserIcon className="w-3/4 h-3/4 opacity-80" />}
                </div>
            )}
            <span className={`font-semibold text-slate-700 whitespace-nowrap ${s.text}`}>
                {displayName}
            </span>
        </div>
    );
}
