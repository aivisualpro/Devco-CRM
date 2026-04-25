'use client';

import useSWR from 'swr';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/lib/context/AppContext';
import { Badge, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, MyDropDown } from '@/components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, Plus, GripVertical, Edit, Copy, Trash2, Activity as ActivityIcon, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import Image from 'next/image';
import { cld } from '@/lib/cld';
import { formatWallDate } from '@/lib/format/date';

// ── Types ────────────────────────────────────────────────────────────────────────
interface TodoItem {
    _id: string;
    task: string;
    dueDate?: string;
    assignees?: string[];
    status: 'todo' | 'in progress' | 'done';
    customerId?: string;
    customerName?: string;
    estimate?: string;
    jobAddress?: string;
    createdBy?: string;
    createdAt?: string;
    lastUpdatedBy?: string;
    lastUpdatedAt?: string;
}

interface Employee { value: string; label: string; image?: string; }

// ── Fetcher ──────────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildDashboardUrl(week: string, scope: string) {
    return `/api/dashboard?week=${encodeURIComponent(week)}&scope=${scope}&section=tasks`;
}

// ── TodoCard ─────────────────────────────────────────────────────────────────────
function TodoCard({
    item,
    employees,
    currentUserEmail,
    isSuperAdmin,
    canViewEstimates,
    onEdit,
    onCopy,
    onStatusChange,
    onDelete,
}: {
    item: TodoItem;
    employees: Employee[];
    currentUserEmail: string;
    isSuperAdmin: boolean;
    canViewEstimates?: boolean;
    onEdit: (item: TodoItem) => void;
    onCopy: (item: TodoItem, e: React.MouseEvent) => void;
    onStatusChange: (item: TodoItem, status: TodoItem['status']) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}) {
    const isOwner = item.createdBy?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
    const canManage = isOwner || isSuperAdmin;

    return (
        <div
            draggable
            onDragStart={e => e.dataTransfer.setData('todoId', item._id)}
            onClick={() => onEdit(item)}
            className="bg-white p-3 rounded-lg border border-slate-200 cursor-grab hover:shadow-md transition-shadow group flex flex-col gap-3"
        >
            <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium whitespace-pre-wrap break-words ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {item.task}
                    </p>
                    {(item.createdAt || item.dueDate) && (
                        <div className="text-xs mt-1 flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-slate-400">
                                {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
                                {item.createdAt && item.dueDate && <span className="mx-1">|</span>}
                                {item.dueDate && <span>Due: {formatWallDate(item.dueDate)}</span>}
                            </p>
                            {item.status === 'done' && item.lastUpdatedAt && (
                                <div className="flex items-center gap-1.5 text-emerald-500 font-medium whitespace-nowrap ml-auto">
                                    <span>Completed: {formatWallDate(item.lastUpdatedAt)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-1">
                <div className="flex -space-x-1.5 overflow-hidden items-center">
                    {item.assignees?.map((email, idx) => {
                        const emp = employees.find(e => e.value === email);
                        const name = emp?.label || email;
                        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                        return (
                            <TooltipProvider key={idx}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Avatar className="w-6 h-6 border-2 border-white ring-1 ring-slate-100">
                                            <AvatarImage src={emp?.image} />
                                            <AvatarFallback className="text-[9px] bg-slate-50 font-black text-slate-600">{initials}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px]">{name}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })}
                    {item.estimate && (
                        <span
                            className={`ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 whitespace-nowrap ${canViewEstimates ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                            onClick={e => { e.stopPropagation(); if (canViewEstimates) window.open(`/estimates/${encodeURIComponent(item.estimate!)}`, '_self'); }}
                        >
                            {item.estimate}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={e => { e.stopPropagation(); const map: Record<string, TodoItem['status']> = { todo: 'in progress', 'in progress': 'done', done: 'todo' }; onStatusChange(item, map[item.status] || 'todo'); }}
                                    className="p-1.5 rounded-lg transition-colors border hover:bg-blue-50 text-slate-400 hover:text-blue-600"
                                >
                                    <ActivityIcon size={12} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-[10px]">Change Status</p></TooltipContent>
                        </Tooltip>
                        {canManage && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button onClick={e => { e.stopPropagation(); onEdit(item); }} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit size={12} /></button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px]">Edit</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button onClick={e => onCopy(item, e)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"><Copy size={12} /></button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px]">Copy</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button onClick={e => onDelete(item._id, e)} className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px]">Delete</p></TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────────────
function KanbanColumn({
    title, items, status, color, employees, currentUserEmail, isSuperAdmin, canViewEstimates,
    onDragOver, onDrop, onEdit, onCopy, onStatusChange, onDelete,
}: {
    title: string; items: TodoItem[]; status: string; color: string;
    employees: Employee[]; currentUserEmail: string; isSuperAdmin: boolean; canViewEstimates?: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    onEdit: (item: TodoItem) => void;
    onCopy: (item: TodoItem, e: React.MouseEvent) => void;
    onStatusChange: (item: TodoItem, s: TodoItem['status']) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}) {
    return (
        <div className="flex-1 min-w-[200px] bg-slate-100 rounded-xl p-3" onDragOver={onDragOver} onDrop={e => onDrop(e, status)}>
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-600">{title}</span>
                <Badge variant="default" className="ml-auto text-[10px] font-bold">{items.length}</Badge>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1 max-h-[350px] scrollbar-thin scrollbar-thumb-slate-200">
                {items.map(item => (
                    <TodoCard
                        key={item._id}
                        item={item}
                        employees={employees}
                        currentUserEmail={currentUserEmail}
                        isSuperAdmin={isSuperAdmin}
                        canViewEstimates={canViewEstimates}
                        onEdit={onEdit}
                        onCopy={onCopy}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
}

// ── TaskFormModal ─────────────────────────────────────────────────────────────────
function TaskFormModal({
    isOpen, onClose, onSave, editingTask, employees, clients, estimates, currentUserEmail, isSuperAdmin,
}: {
    isOpen: boolean; onClose: () => void; onSave: (data: Partial<TodoItem>) => void;
    editingTask?: TodoItem | null; employees: any[]; clients: any[]; estimates: any[];
    currentUserEmail: string; isSuperAdmin: boolean;
}) {
    const isEditing = !!editingTask?._id;
    const canEdit = !isEditing || editingTask?.createdBy === currentUserEmail || isSuperAdmin;
    const [formData, setFormData] = useState<Partial<TodoItem>>({ task: '', dueDate: '', status: 'todo', assignees: [] });
    const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isCustomerOpen, setIsCustomerOpen] = useState(false);
    const [isEstimateOpen, setIsEstimateOpen] = useState(false);

    const employeeOptions = useMemo(() => employees.map(e => ({ id: e.value, label: e.label, value: e.value, profilePicture: e.image })), [employees]);
    const filteredClients = useMemo(() => {
        let f = clients || [];
        if (customerSearch.trim()) f = f.filter((c: any) => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()));
        return f.slice(0, 20);
    }, [clients, customerSearch]);
    const filteredEstimates = useMemo(() => {
        let f = estimates || [];
        if (formData.customerId) f = f.filter((e: any) => String(e.customerId) === String(formData.customerId));
        if (estimateSearch.trim()) f = f.filter((e: any) => (e.value || '').toLowerCase().includes(estimateSearch.toLowerCase()) || (e.projectName || '').toLowerCase().includes(estimateSearch.toLowerCase()));
        return f.slice(0, 20);
    }, [estimates, formData.customerId, estimateSearch]);

    useState(() => {
        if (editingTask) {
            setFormData({ task: editingTask.task, dueDate: editingTask.dueDate?.slice(0, 10), status: editingTask.status, assignees: editingTask.assignees || [], customerId: editingTask.customerId, customerName: editingTask.customerName, estimate: editingTask.estimate, jobAddress: editingTask.jobAddress });
        } else {
            setFormData({ task: '', dueDate: '', status: 'todo', assignees: [] });
        }
    });

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingTask ? 'Edit Task' : 'Add New Task'}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Task Description</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-h-[100px]" placeholder="What needs to be done?" value={formData.task} onChange={e => setFormData({ ...formData, task: e.target.value })} disabled={!canEdit} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                        <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none" value={formData.dueDate || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} disabled={!canEdit} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} disabled={!canEdit}>
                            <option value="todo">To Do</option>
                            <option value="in progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                </div>
                <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Assign To</label>
                    <div id="task-assignee-trigger" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between cursor-pointer hover:border-blue-300 min-h-[50px]" onClick={() => canEdit && setIsAssigneeOpen(!isAssigneeOpen)}>
                        <div className="flex -space-x-2 overflow-hidden">
                            {(formData.assignees || []).length > 0 ? formData.assignees?.map(email => {
                                const emp = employees.find(e => e.value === email);
                                return <div key={email} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm" title={emp?.label || email}>{emp?.label?.[0] || email[0]}</div>;
                            }) : <span className="text-slate-400 ml-1">Select team members...</span>}
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`} />
                    </div>
                    <MyDropDown isOpen={isAssigneeOpen} onClose={() => setIsAssigneeOpen(false)} anchorId="task-assignee-trigger" options={employeeOptions} selectedValues={formData.assignees || []} multiSelect={true} onSelect={val => { if (!canEdit) return; const cur = formData.assignees || []; setFormData({ ...formData, assignees: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] }); }} />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSave(formData)} disabled={!formData.task?.trim() || !canEdit} className={`bg-blue-600 hover:bg-blue-700 text-white ${!canEdit ? 'hidden' : ''}`}>{editingTask ? 'Update Task' : 'Create Task'}</Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Main TaskList Component ───────────────────────────────────────────────────────
export function TaskList({
    week,
    scope,
    initialData,
    className,
}: {
    week: string;
    scope: 'all' | 'self';
    initialData?: any;
    className?: string;
}) {
    const { user, isSuperAdmin, can } = usePermissions();
    const currentUser = useCurrentUser();
    const userEmail = currentUser?.email || '';
    const canViewEstimates = can(MODULES.ESTIMATES, ACTIONS.VIEW);

    const { data, mutate } = useSWR(
        week ? buildDashboardUrl(week, scope) : null,
        fetcher,
        {
            fallbackData: initialData,
            revalidateOnFocus: true,
            dedupingInterval: 30000,
            keepPreviousData: true,
        }
    );

    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TodoItem | null>(null);
    const [taskView, setTaskView] = useState<'self' | 'all'>('self');

    // Sync SWR data → local state
    useEffect(() => {
        if (data?.tasks) setTodos(data.tasks);
    }, [data?.tasks]);

    const todosByStatus = useMemo(() => {
        const filtered = taskView === 'self' ? todos.filter(t => t.assignees?.includes(userEmail) || t.createdBy === userEmail) : todos;
        return {
            todo: filtered.filter(t => t.status === 'todo'),
            'in progress': filtered.filter(t => t.status === 'in progress'),
            done: filtered.filter(t => t.status === 'done'),
        };
    }, [todos, taskView, userEmail]);

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const todoId = e.dataTransfer.getData('todoId');
        setTodos(prev => prev.map(t => t._id === todoId ? { ...t, status: newStatus as TodoItem['status'] } : t));
        await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: todoId, status: newStatus, lastUpdatedBy: userEmail }) });
    }, [userEmail]);

    const handleStatusChange = useCallback(async (item: TodoItem, newStatus: TodoItem['status']) => {
        setTodos(prev => prev.map(t => t._id === item._id ? { ...t, status: newStatus, lastUpdatedAt: new Date().toISOString() } : t));
        await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item._id, status: newStatus, lastUpdatedBy: userEmail }) });
    }, [userEmail]);

    const handleOpenModal = useCallback((task?: TodoItem) => {
        setEditingTask(task || null);
        setIsModalOpen(true);
    }, []);

    const handleSaveTask = useCallback(async (formData: Partial<TodoItem>) => {
        const isEditing = !!editingTask?._id;
        try {
            const res = await fetch('/api/tasks', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEditing ? { ...formData, id: editingTask._id } : { ...formData, createdBy: userEmail, status: formData.status || 'todo' }),
            });
            const data = await res.json();
            if (data.success) {
                setTodos(prev => isEditing ? prev.map(t => t._id === editingTask._id ? { ...t, ...formData } : t) : [data.task || { ...formData, _id: Date.now().toString() } as any, ...prev]);
                setIsModalOpen(false);
                toast.success(isEditing ? 'Task updated' : 'Task created');
                mutate();
            }
        } catch { toast.error('Failed to save task'); }
    }, [editingTask, userEmail, mutate]);

    const handleCopyTask = useCallback((item: TodoItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTask(null);
        setIsModalOpen(true);
    }, []);

    const handleDeleteTask = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setTodos(prev => prev.filter(t => t._id !== id));
        await fetch('/api/tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        toast.success('Task deleted');
        mutate();
    }, [mutate]);

    const employees = initialData?.employees || data?.employees || [];
    const clients = initialData?.clients || data?.clients || [];
    const estimates = initialData?.estimates || data?.estimates || [];

    const columnProps = { employees, currentUserEmail: userEmail, isSuperAdmin: !!isSuperAdmin, canViewEstimates, onDragOver: handleDragOver, onDrop: handleDrop, onEdit: handleOpenModal, onCopy: handleCopyTask, onStatusChange: handleStatusChange, onDelete: handleDeleteTask };

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 ${className || ''}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-rose-600" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">Tasks</h2>
                </div>
                <div className="flex items-center gap-3">
                    {scope === 'all' && (
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {(['self', 'all'] as const).map(v => (
                                <button key={v} onClick={() => setTaskView(v)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors capitalize ${taskView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{v}</button>
                            ))}
                        </div>
                    )}
                    <button onClick={() => handleOpenModal()} className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-all shadow-sm active:scale-95">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="hidden lg:flex gap-4 overflow-x-auto">
                <KanbanColumn title="To Do" items={todosByStatus.todo} status="todo" color="bg-slate-400" {...columnProps} />
                <KanbanColumn title="In Progress" items={todosByStatus['in progress']} status="in progress" color="bg-blue-500" {...columnProps} />
                <KanbanColumn title="Done" items={todosByStatus.done} status="done" color="bg-emerald-500" {...columnProps} />
            </div>

            {/* Mobile list */}
            <div className="lg:hidden space-y-2">
                {todos.slice(0, 5).map(item => (
                    <TodoCard key={item._id} item={item} {...columnProps} />
                ))}
            </div>

            <TaskFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTask}
                editingTask={editingTask}
                employees={employees}
                clients={clients}
                estimates={estimates}
                currentUserEmail={userEmail}
                isSuperAdmin={!!isSuperAdmin}
            />
        </div>
    );
}
