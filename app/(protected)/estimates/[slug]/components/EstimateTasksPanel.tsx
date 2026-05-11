'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Plus, ChevronDown, ChevronRight, Link as LinkIcon, Loader2, Trash2, Play, RotateCcw, Check, User } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  todo: { label: 'To Do', color: 'text-slate-600', dot: 'bg-slate-400', bg: 'bg-slate-50' },
  'in progress': { label: 'In Progress', color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50' },
  done: { label: 'Done', color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
};

const STATUS_CYCLE: Record<string, TaskItem['status']> = {
  todo: 'in progress', 'in progress': 'done', done: 'todo',
};

// ── Main Component ──
export const EstimateTasksPanel: React.FC<EstimateTasksPanelProps> = ({
  estimateNumber, customerId, customerName, currentUser, employees, onTaskMutate,
}) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['todo', 'in progress']));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const { isSuperAdmin } = usePermissions();

  // SWR — filter by estimate
  const swrKey = estimateNumber ? `/api/tasks?estimate=${encodeURIComponent(estimateNumber)}&limit=200` : null;
  const { data, mutate, isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true, dedupingInterval: 5000,
  });

  const tasks: TaskItem[] = data?.items || [];

  // Group by status
  const grouped = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo'),
    'in progress': tasks.filter(t => t.status === 'in progress'),
    done: tasks.filter(t => t.status === 'done' && !t.archived),
  }), [tasks]);

  const totalCount = tasks.filter(t => !t.archived).length;

  // Fetch clients & estimates for the TaskFormModal
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

  // Resolve employee data
  const getEmployeeData = useCallback((emailOrId: string) => {
    const safeVal = String(emailOrId || '').toLowerCase();
    const emp = employees.find((e: any) =>
      String(e.email || '').toLowerCase() === safeVal ||
      e._id === emailOrId ||
      String(e.value || '').toLowerCase() === safeVal
    );
    if (!emp) return null;
    return {
      label: emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emailOrId,
      image: emp.profilePicture || emp.image || '',
      initials: ((emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')).toUpperCase() || emailOrId?.[0]?.toUpperCase() || 'U',
    };
  }, [employees]);

  // Toggle section
  const toggleSection = (key: string) => {
    setOpenSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  // Toggle expanded task description
  const toggleExpanded = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Status change
  const handleStatusChange = useCallback(async (task: TaskItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = STATUS_CYCLE[task.status];
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

  // Create / Edit
  const openCreate = () => { setEditingTask(null); setCreateOpen(true); };
  const openEdit = (task: TaskItem) => { setEditingTask(task); setCreateOpen(true); };

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

  // Pre-fill editingTask with estimate context
  const editingTaskWithContext = useMemo(() => {
    if (editingTask) return editingTask as TodoItem;
    return {
      _id: '',
      task: '',
      status: 'todo' as const,
      estimate: estimateNumber,
      customerId: customerId || '',
      customerName: customerName || '',
    } as TodoItem;
  }, [editingTask, estimateNumber, customerId, customerName]);

  // Status action button config
  const getStatusAction = (status: string) => {
    const next = STATUS_CYCLE[status];
    if (next === 'in progress') return { label: 'Start', icon: Play, color: 'text-blue-600 hover:bg-blue-50 border-blue-200 hover:border-blue-300' };
    if (next === 'done') return { label: 'Done', icon: Check, color: 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-300' };
    return { label: 'Reopen', icon: RotateCcw, color: 'text-amber-600 hover:bg-amber-50 border-amber-200 hover:border-amber-300' };
  };

  return (
    <CommunicationPanel
      icon={<CheckCircle2 size={16} />}
      iconBg="from-rose-500 to-rose-600"
      title="Tasks"
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
            <p className="text-[10px] text-slate-400 mt-1">Click &quot;+&quot; to create one.</p>
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
                <div className="ml-3 pl-3 border-l border-slate-200 space-y-2.5 mt-1 mb-2">
                  {items.map(task => {
                    const creator = getEmployeeData(task.createdBy || '');
                    const isExpanded = expandedTasks.has(task._id);
                    const statusAction = getStatusAction(task.status);
                    const StatusIcon = statusAction.icon;
                    const assignees = (task.assignees || []).map(a => {
                      const emp = getEmployeeData(String(a));
                      return emp || { label: String(a).split('@')[0], image: '', initials: String(a)[0]?.toUpperCase() || 'U' };
                    });

                    return (
                      <div key={task._id}
                        onClick={() => openEdit(task)}
                        className={`bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-2.5 overflow-hidden ${task.status === 'done' ? 'opacity-60' : ''}`}
                      >
                        {/* Row 1: CreatedBy avatar + name  ·  Due date */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="relative w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden shrink-0">
                                    {creator?.image ? (
                                      <img src={creator.image} alt={creator.label} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{creator?.initials || 'U'}</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Created by {creator?.label || task.createdBy}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs font-bold text-slate-500 truncate">{creator?.label || task.createdBy?.split('@')[0] || 'Unknown'}</span>
                            {task.createdAt && (
                              <>
                                <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400 shrink-0">{formatWallDate(task.createdAt)}</span>
                              </>
                            )}
                          </div>
                          {task.dueDate && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                              new Date(task.dueDate) < new Date() && task.status !== 'done'
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : 'bg-slate-50 text-slate-500 border border-slate-100'
                            }`}>
                              Due {formatWallDate(task.dueDate)}
                            </span>
                          )}
                        </div>

                        {/* Row 2: Task description — 2 lines, expandable */}
                        <div>
                          <p className={`text-[13px] font-semibold leading-relaxed text-slate-800 ${
                            task.status === 'done' ? 'line-through text-slate-400' : ''
                          } ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {task.task}
                          </p>
                          {task.task.length > 80 && (
                            <button
                              onClick={(e) => toggleExpanded(task._id, e)}
                              className="text-[10px] font-bold text-blue-500 hover:text-blue-700 mt-0.5 transition-colors"
                            >
                              {isExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>

                        {/* Linked followup badge */}
                        {task.linkedFollowupId && (
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="w-3 h-3 text-violet-400" />
                            <span className="text-[9px] font-bold text-violet-500">Linked to followup</span>
                          </div>
                        )}

                        {/* Footer: Assignees + Status Action + Delete */}
                        <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          {/* Assignee avatars */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex -space-x-1.5">
                              {assignees.length > 0 ? assignees.slice(0, 4).map((a, i) => (
                                <TooltipProvider key={i}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="relative w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shadow-sm overflow-hidden shrink-0">
                                        {a.image ? (
                                          <img src={a.image} alt={a.label} className="w-full h-full object-cover" />
                                        ) : (
                                          <span>{a.initials}</span>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px] font-bold">{a.label}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )) : (
                                <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                  <User className="w-3 h-3 text-slate-300" />
                                </div>
                              )}
                              {assignees.length > 4 && (
                                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0">
                                  +{assignees.length - 4}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status action + delete */}
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleStatusChange(task, e)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border shadow-sm transition-all ${statusAction.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{statusAction.label}</span>
                            </button>
                            <button
                              onClick={e => handleDelete(task._id, e)}
                              className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
        hideClientEstimate={true}
      />
    </CommunicationPanel>
  );
};

export default EstimateTasksPanel;
