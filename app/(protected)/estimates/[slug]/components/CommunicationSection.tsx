'use client';
import React from 'react';
import { EstimateChat } from '@/components/ui/EstimateChat';
import { FollowupReminders } from './FollowupReminders';
import { EstimateTasksPanel } from './EstimateTasksPanel';
import { CommunicationPanel } from './CommunicationPanel';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { MessageSquare } from 'lucide-react';

interface CommunicationSectionProps {
  slug: string;
  formData: any;
  employees: any[];
  currentUser: any;
  planningOptions: any[];
  onTaskMutate?: () => void;
}

export const CommunicationSection: React.FC<CommunicationSectionProps> = ({
  slug, formData, employees, currentUser, planningOptions, onTaskMutate,
}) => {
  const { can } = usePermissions();
  const permissions = {
    canCreate: can(MODULES.TASKS, ACTIONS.CREATE),
    canEdit:   can(MODULES.TASKS, ACTIONS.EDIT),
    canDelete: can(MODULES.TASKS, ACTIONS.DELETE),
  };

  return (
    <div className="bg-[#eef2f6] rounded-2xl lg:rounded-[40px] p-2 lg:p-4">
      {/* 3 cols at desktop ≥1280px, 2 at tablet (768-1279), 1 at mobile (<768) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4 items-stretch">

        {/* COL 1 — Estimate Chat */}
        <div className="min-h-[520px]">
          <CommunicationPanel
            icon={<MessageSquare size={16} />}
            iconBg="from-slate-600 to-slate-700"
            title="Estimate Chat"
            badge={<span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-black">#{formData?.estimate}</span>}
            contentClassName="!p-0"
          >
            <EstimateChat
              estimateId={formData?.estimate}
              currentUserEmail={currentUser?.email}
              employees={employees}
              chromeless
            />
          </CommunicationPanel>
        </div>

        {/* COL 2 — Followups & Reminders */}
        <div className="min-h-[520px]">
          <FollowupReminders
            estimateNumber={formData?.estimate || slug}
            estimateId={formData?._id}
            customerId={formData?.customerId}
            customerName={formData?.customerName}
            currentUser={currentUser}
            employees={employees}
            permissions={permissions}
          />
        </div>

        {/* COL 3 — Estimate Tasks (filtered to this estimate) */}
        <div className="min-h-[520px] md:col-span-2 xl:col-span-1">
          <EstimateTasksPanel
            estimateNumber={formData?.estimate || slug}
            customerId={formData?.customerId}
            customerName={formData?.customerName}
            currentUser={currentUser}
            employees={employees}
            onTaskMutate={onTaskMutate}
          />
        </div>

      </div>
    </div>
  );
};
