'use client';
import { ReactNode } from 'react';

interface CommunicationPanelProps {
  icon: ReactNode;                    // already-styled icon node (lucide w/ color)
  iconBg: string;                     // tailwind gradient classes for the icon square,
                                      //   e.g. 'from-slate-600 to-slate-700'
                                      //         'from-violet-500 to-violet-600'
                                      //         'from-rose-500 to-rose-600'
  title: string;
  badge?: ReactNode;                  // small chip next to the title
  subtitle?: ReactNode;               // optional 2nd line below the title
  actions?: ReactNode;                // header right-side action buttons ("+ New", etc.)
  children: ReactNode;                // the content area
  contentClassName?: string;          // optional content-area overrides
}

export function CommunicationPanel({
  icon, iconBg, title, badge, subtitle, actions, children, contentClassName = '',
}: CommunicationPanelProps) {
  return (
    <div className="h-full flex flex-col space-y-3">

      {/* Header — sits ABOVE the neumorphic content box (matches Job Docs layout) */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex items-center gap-2 shrink-0">
          {/* Icon-in-rounded-square with gradient */}
          <div className={`w-7 h-7 rounded-[10px] bg-gradient-to-br ${iconBg} text-white flex items-center justify-center shadow-sm`}>
            {icon}
          </div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-bold text-[#0F4C75] tracking-tight">{title}</h4>
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {subtitle && <div className="flex items-center gap-1.5">{subtitle}</div>}
          {actions}
        </div>
      </div>

      {/* Content area — neumorphic inset box matching Job Docs style */}
      <div className={`flex-1 min-h-0 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] flex flex-col overflow-hidden ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
