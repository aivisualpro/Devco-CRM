'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Plus, ChevronDown, ChevronRight, Link as LinkIcon, Loader2, Activity as ActivityIcon, Trash2, Edit } from 'lucide-react';
import { Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { CommunicationPanel } from './CommunicationPanel';
import { getPusherClient } from '@/lib/realtime/pusher-client';
import { formatWallDate } from '@/lib/format/date';
import toast from 'react-hot-toast';
import { TaskFormModal, TodoItem } from '@/app/(protected)/dashboard/_components/TaskList';
import { usePermissions } from '@/hooks/usePermissions';

// ── Types ──
interface TaskItem {
  _id: string;
  task: string;
  dueDate?: string;
  assignees?: string[];
  status: 'todo' | 'in progress' | 'done';
  createdBy?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  linkedFollowupId?: string;
  archived?: boolean;
  customerId?: string;
  customerName?: string;
  estimate?: string;
  jobAddress?: string;
}

interface EstimateTasksPanelProps {
  estimateNumber: string;
  customerId?: string;
  customerName?: string;
  currentUser: any;
  employees: any[];
  onTaskMutate?: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  todo: { label: 'To Do', color: 'text-slate-600', dot: 'bg-slate-400' },
  'in progress': { label: 'In Progress', color: 'text-blue-600', dot: 'bg-blue-500' },
  done: { label: 'Done', color: 'text-emerald-600', dot: 'bg-emerald-500' },
};

const STATUS_CYCLE: Record<string, TaskItem['status']> = {
  todo: 'in progress', 'in progress': 'done', done: 'todo',
};

// ── Main Component ──
export const EstimateTasksPanel: React.FC<EstimateTasksPanelProps> = ({
  estimateNumber, customerId, customerName, currentUser, employees, onTaskMutate,
}) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['todo']));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const { isSuperAdmin } = usePermissions();

  // SWR — filter by estimate
  const swrKey = estimateNumber ? `/api/tasks?estimate=${encodeURIComponent(estimateNumber)}&limit=200` : null;
  const { data, mutate, isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true, dedupingInterval: 5000,
  });

  const tasks: TaskItem[] = data?.items || [];
  const statusCounts = data?.statusCounts || {};

  // Group by status
  const grouped = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo'),
    'in progress': tasks.filter(t => t.status === 'in progress'),
    done: tasks.filter(t => t.status === 'done' && !t.archived),
  }), [tasks]);

  const totalCount = tasks.filter(t => !t.archived).length;

  // Fetch clients & estimates for the TaskFormModal (same data the dashboard provides)
  const { data: clientsData } = useSWR('/api/clients?limit=500', fetcher, {
    dedupingInterval: 60000, revalidateOnFocus: false,
  });
  const { data: estimatesData } = useSWR('/api/estimates?limit=500&fields=estimate,projectName,customerId,jobAddress', fetcher, {
    dedupingInterval: 60000, revalidateOnFocus: false,
  });

  const clientsList = useMemo(() => clientsData?.items || clientsData?.result || [], [clientsData]);
  const estimatesList = useMemo(() => {
    const raw = estimatesData?.items || estimatesData?.result || [];
    return raw.map((e: any) => ({
      estimate: e.estimate || e.proposalNo,
      projectName: e.projectName || e.jobName || '',
      customerId: e.customerId,
      jobAddress: e.jobAddress || '',
    }));
  }, [estimatesData]);

  // Map employees for TaskFormModal
  const mappedEmployees = useMemo(() =>
    (employees || []).map((emp: any) => ({
      _id: emp._id,
      email: emp.email || '',
      firstName: emp.firstName || emp.name?.split(' ')[0] || '',
      lastName: emp.lastName || emp.name?.split(' ').slice(1).join(' ') || '',
      profilePicture: emp.profilePicture || emp.image || '',
    })),
  [employees]);

  // Pusher
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;
    const ch = pusher.subscribe('private-org-tasks');
    const handler = () => mutate();
    ch.bind('task-created', handler);
    ch.bind('task-updated', handler);
    ch.bind('task-deleted', handler);
    return () => { ch.unbind_all(); };
  }, [mutate]);

  // Resolve employee name
  const empName = useCallback((email: string) => {
    const e = employees.find((emp: any) => String(emp.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (e) return `${e.firstName || ''} ${e.lastName || ''}`.trim() || email;
    return email?.split('@')[0] || 'Unknown';
  }, [employees]);

  // Toggle section
  const toggleSection = (key: string) => {
    setOpenSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  // Status change
  const handleStatusChange = useCallback(async (task: TaskItem) => {
    const newStatus = STATUS_CYCLE[task.status];
    // Optimistic
    mutate((prev: any) => {
      if (!prev?.items) return prev;
      return { ...prev, items: prev.items.map((t: any) => t._id === task._id ? { ...t, status: newStatus } : t) };
    }, false);

    await fetch('/api/tasks', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task._id, status: newStatus, lastUpdatedBy: currentUser?.email }),
    });
    mutate();
    onTaskMutate?.();
  }, [currentUser?.email, mutate, onTaskMutate]);

  // Delete
  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) { toast.success('Task deleted'); mutate(); onTaskMutate?.(); }
    else toast.error(json.error || 'Failed');
  }, [mutate, onTaskMutate]);

  // Create / Edit — open the full TaskFormModal
  const openCreate = () => {
    setEditingTask(null);
    setCreateOpen(true);
  };
  const openEdit = (task: TaskItem) => {
    setEditingTask(task);
    setCreateOpen(true);
  };

  // Save handler for TaskFormModal
  const handleSave = useCallback(async (formData: Partial<TodoItem>) => {
    const isEditing = !!editingTask?._id;
    try {
      const payload = isEditing
        ? { ...formData, id: editingTask._id, lastUpdatedBy: currentUser?.email }
        : {
            ...formData,
            createdBy: currentUser?.email,
            status: formData.status || 'todo',
            // Auto-inject estimate/customer context when creating from estimate view
            estimate: formData.estimate || estimateNumber,
            customerId: formData.customerId || customerId,
            customerName: formData.customerName || customerName,
          };

      const res = await fetch('/api/tasks', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isEditing ? 'Task updated' : 'Task created');
        mutate();
        setCreateOpen(false);
        onTaskMutate?.();
      } else {
        toast.error(json.error || 'Failed to save task');
      }
    } catch {
      toast.error('Network error');
    }
  }, [editingTask, currentUser?.email, estimateNumber, customerId, customerName, mutate, onTaskMutate]);

  // Pre-fill editingTask with estimate context when creating a new task
  const editingTaskWithContext = useMemo(() => {
    if (editingTask) return editingTask as TodoItem;
    // For new tasks, return a pre-filled context so the form starts with estimate/customer
    return {
      _id: '',
      task: '',
      status: 'todo' as const,
      estimate: estimateNumber,
      customerId: customerId || '',
      customerName: customerName || '',
    } as TodoItem;
  }, [editingTask, estimateNumber, customerId, customerName]);

  return (
    <CommunicationPanel
      icon={<CheckCircle2 size={16} />}
      iconBg="from-rose-500 to-rose-600"
      title="Tasks"
      subtitle={
        <>
          {(['todo', 'in progress', 'done'] as const).map(s => {
            const cnt = s === 'done' ? (statusCounts['done'] ?? grouped.done.length) : grouped[s].length;
            const cfg = STATUS_CONFIG[s];
            return (
              <span key={s} className={`text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums flex items-center gap-1 ${
                s === 'in progress' ? 'text-blue-700 bg-blue-50' : s === 'done' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cnt}
              </span>
            );
          })}
        </>
      }
      actions={
        <button onClick={openCreate}
          className="p-1.5 px-2 bg-rose-100 text-rose-600 rounded-[10px] hover:bg-rose-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      }
    >
      {/* Collapsible sections */}
      <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-rose-400" /></div>
        ) : totalCount === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 font-bold">No tasks for this estimate.</p>
            <p className="text-[10px] text-slate-400 mt-1">Click &quot;+ New&quot; to create one.</p>
          </div>
        ) : (['todo', 'in progress', 'done'] as const).map(status => {
          const items = grouped[status];
          const cfg = STATUS_CONFIG[status];
          const isOpen = openSections.has(status);
          if (items.length === 0) return null;
          return (
            <div key={status} className="mb-2">
              <button onClick={() => toggleSection(status)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-bold text-slate-700 flex-1 text-left">{cfg.label}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 tabular-nums">{items.length}</span>
              </button>

              {isOpen && (
                <div className="ml-3 pl-3 border-l border-slate-200 space-y-1.5 mt-1 mb-2">
                  {items.map(task => {
                    const isOwner = task.createdBy?.toLowerCase() === currentUser?.email?.toLowerCase();
                    return (
                      <div key={task._id}
                        className={`p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md cursor-pointer ${task.status === 'done' ? 'opacity-60' : ''}`}
                        onClick={() => openEdit(task)}>
                        {/* Title row */}
                        <div className="flex items-start gap-1.5">
                          <p className={`text-[11px] font-semibold leading-snug flex-1 truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {task.task}
                          </p>
                          {task.linkedFollowupId && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <LinkIcon className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Linked to followup</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                          {task.dueDate && <span>Due: {formatWallDate(task.dueDate)}</span>}
                          {task.createdBy && <span className="truncate max-w-[100px]">{empName(task.createdBy)}</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-50">
                          <button onClick={e => { e.stopPropagation(); handleStatusChange(task); }}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-1">
                            <ActivityIcon className="w-2.5 h-2.5" />{STATUS_CYCLE[task.status] === 'done' ? 'Done' : STATUS_CYCLE[task.status] === 'in progress' ? 'Start' : 'Reopen'}
                          </button>
                          <span className="flex-1" />
                          {isOwner && (
                            <button onClick={e => handleDelete(task._id, e)}
                              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dashboard's TaskFormModal — same form as the main dashboard */}
      <TaskFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleSave}
        editingTask={createOpen ? editingTaskWithContext : null}
        employees={mappedEmployees}
        clients={clientsList}
        estimates={estimatesList}
        currentUserEmail={currentUser?.email || ''}
        isSuperAdmin={!!isSuperAdmin}
      />
    </CommunicationPanel>
  );
};

export default EstimateTasksPanel;
