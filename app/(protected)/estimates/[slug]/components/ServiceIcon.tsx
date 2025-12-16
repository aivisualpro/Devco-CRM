'use client';

import { ReactNode } from 'react';

interface ServiceIconProps {
    id: string;
    label: string;
    icon: ReactNode;
    isActive: boolean;
    isStatus?: boolean;
    onClick: () => void;
}

export function ServiceIcon({
    id,
    label,
    icon,
    isActive,
    isStatus = false,
    onClick
}: ServiceIconProps) {
    return (
        <div
            onClick={onClick}
            className={`
                group relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300
                ${isActive
                    ? isStatus
                        ? 'shadow-[inset_4px_4px_8px_#b8e0c8,inset_-4px_-4px_8px_#ffffff] text-emerald-600 bg-emerald-50/50'
                        : 'shadow-[inset_4px_4px_8px_#d1d9e6,inset_-4px_-4px_8px_#ffffff] text-blue-600'
                    : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 text-slate-400'
                }
            `}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {icon}
            </svg>

            {/* Tooltip */}
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                {label}
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
            </div>
        </div>
    );
}

// Service definitions with their icons
export const servicesList = [
    {
        id: 'directionalDrilling',
        label: 'Directional Drilling',
        icon: <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25M12 11l-2.5-1.25M12 16l-5-2.5M12 16l5-2.5M2 17l10 5 10-5" />
    },
    {
        id: 'excavationBackfill',
        label: 'Excavation & Backfill',
        icon: <path d="M2 22h20M2 12l2-2 3 3 5-5 3 3 5-5 2 2" strokeLinecap="round" strokeLinejoin="round" />
    },
    {
        id: 'hydroExcavation',
        label: 'Hydro-excavation',
        icon: <path d="M12 2.69l5.74 8.2a8 8 0 1 1-11.48 0L12 2.69z" />
    },
    {
        id: 'potholingCoring',
        label: 'Potholing & Coring',
        icon: <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    },
    {
        id: 'asphaltConcrete',
        label: 'Asphalt & Concrete',
        icon: <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2zm0-4h16M4 14h16M4 10h16M4 6h16" />
    }
];

export const statusIcon = {
    id: 'status',
    label: 'Confirmed',
    icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
};
