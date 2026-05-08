'use client';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { Phone, Plus, ChevronDown, ChevronRight, Check, AlarmClock, Clock, MoreHorizontal, Loader2, History, Zap } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { CommunicationPanel } from './CommunicationPanel';
import { getPusherClient } from '@/lib/realtime/pusher-client';
import { formatWallDate, formatWallTime, toWallClockISO } from '@/lib/format/date';

// ── Types ──
interface FollowupGroup {
  createdBy: string;
  createdByName: string;
  items: any[];
  totalCount: number;
  dueCount: number;
}

interface FollowupRemindersProps {
  estimateNumber: string;
  estimateId?: string;
  customerId?: string;
  customerName?: string;
  currentUser: any;
  employees: any[];
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}

// ── Helpers ──
const fetcher = (url: string) => fetch(url).then(r => r.json());



function getRowState(f: any) {
  const now = new Date().toISOString();
  if (f.status === 'completed') return 'completed';
  if (f.status === 'snoozed') return 'snoozed';
  if (f.status === 'open' && f.nextFollowupDate) {
    if (f.nextFollowupDate < now) return 'overdue';
    const diffMs = new Date(f.nextFollowupDate).getTime() - Date.now();
    if (diffMs <= 60 * 60 * 1000) return 'due-now';
  }
  return 'open';
}

function fmtShortDate(iso: string) {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, , mo, d] = m;
  const t = formatWallTime(iso);
  return `${mo}/${d} ${t}`;
}

// ── Main Component ──
export const FollowupReminders: React.FC<FollowupRemindersProps> = ({
  estimateNumber, estimateId, customerId, customerName, currentUser, employees, permissions,
}) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [snoozePopoverId, setSnoozePopoverId] = useState<string | null>(null);
  const [snoozeCustomDate, setSnoozeCustomDate] = useState('');
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);
  const snoozeAnchorRef = useRef<HTMLButtonElement | null>(null);

  // Form state
  const [form, setForm] = useState({
    remarks: '', nextFollowupDate: '',
  });

  // SWR
  const swrKey = estimateNumber ? `/api/followups?estimateNumber=${estimateNumber}&groupBy=createdBy` : null;
  const { data, mutate, isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true, dedupingInterval: 5000,
  });
  const groups: FollowupGroup[] = data?.groups || [];

  // Summary stats — due = open (not done), overdue = past nextFollowupDate
  const stats = useMemo(() => {
    let due = 0, overdue = 0;
    const now = Date.now();
    for (const g of groups) {
      for (const f of g.items) {
        if (f.status === 'open') {
          due++;
          if (f.nextFollowupDate && new Date(f.nextFollowupDate).getTime() < now) {
            overdue++;
          }
        }
      }
    }
    return { due, overdue };
  }, [groups]);

  // Pusher subscription
  useEffect(() => {
    if (!currentUser?.email) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const ch = pusher.subscribe('private-org-followups');
    const handler = () => mutate();
    ch.bind('followup-created', handler);
    ch.bind('followup-updated', handler);
    ch.bind('followup-completed', handler);
    ch.bind('followup-deleted', handler);

    // User-specific reminder channel
    const sanitized = currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const userCh = pusher.subscribe(`private-user-${sanitized}`);
    const reminderHandler = (data: any) => {
      toast(`Followup due soon: ${data.estimateNumber} — ${(data.remarks || '').substring(0, 60)}`, { icon: '⏰', duration: 8000 });
      mutate();
    };
    userCh.bind('followup.reminder', reminderHandler);

    return () => {
      ch.unbind('followup-created', handler);
      ch.unbind('followup-updated', handler);
      ch.unbind('followup-completed', handler);
      ch.unbind('followup-deleted', handler);
      userCh.unbind('followup.reminder', reminderHandler);
    };
  }, [currentUser?.email, mutate]);

  // Resolve employee name
  const empName = useCallback((email: string) => {
    const e = employees.find((emp: any) => (emp.email || '').toLowerCase() === email?.toLowerCase());
    if (e) return `${e.firstName || ''} ${e.lastName || ''}`.trim() || email;
    return email?.split('@')[0] || 'Unknown';
  }, [employees]);

  // Resolve employee avatar
  const empAvatar = useCallback((email: string) => {
    const e = employees.find((emp: any) => (emp.email || '').toLowerCase() === email?.toLowerCase());
    return e?.profilePicture || e?.image || '';
  }, [employees]);

  // Toggle accordion
  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Create followup
  const handleCreate = async () => {
    if (!form.remarks.trim()) { toast.error('Remarks are required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateNumber, estimateId, customerId, customerName,
          followupDate: toWallClockISO(new Date()),
          remarks: form.remarks, nextFollowupDate: form.nextFollowupDate || '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Followup created');
        mutate();
        setCreateOpen(false);
        setForm({ remarks: '', nextFollowupDate: '' });
      } else { toast.error(json.error || 'Failed'); }
    } catch { toast.error('Network error'); }
    setSubmitting(false);
  };

  // Actions
  const handleAction = async (id: string, action: 'complete' | 'reopen' | 'delete') => {
    setActionMenuId(null);
    const body: any = {};
    if (action === 'complete') body.status = 'completed';
    else if (action === 'reopen') body.status = 'open';
    else if (action === 'delete') {
      const res = await fetch(`/api/followups/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Deleted'); mutate(); } else toast.error(json.error || 'Failed');
      return;
    }
    const res = await fetch(`/api/followups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) { toast.success(action === 'complete' ? 'Completed!' : 'Reopened'); mutate(); }
    else toast.error(json.error || 'Failed');
  };

  // 9.4 — Snooze with reason
  const handleSnooze = async (id: string, option: string, customDate?: string) => {
    setSnoozePopoverId(null);
    setSnoozeCustomDate('');
    const now = new Date();
    let target: Date;
    if (option === 'custom' && customDate) {
      target = new Date(customDate);
      if (isNaN(target.getTime())) { toast.error('Invalid date'); return; }
    } else {
      switch (option) {
        case '1h': target = new Date(now.getTime() + 3600000); break;
        case '4h': target = new Date(now.getTime() + 14400000); break;
        case 'tomorrow': target = new Date(now); target.setDate(target.getDate() + 1); target.setHours(8, 0, 0, 0); break;
        case 'monday': { target = new Date(now); const day = target.getDay(); const diff = day === 0 ? 1 : 8 - day; target.setDate(target.getDate() + diff); target.setHours(8, 0, 0, 0); break; }
        default: target = new Date(now.getTime() + 86400000); break;
      }
    }
    const res = await fetch(`/api/followups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'snoozed', snoozedUntil: toWallClockISO(target) }),
    });
    const json = await res.json();
    if (json.success) { toast.success(`Snoozed until ${target.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`); mutate(); }
    else toast.error(json.error || 'Failed');
  };

  // ── Row border + badge ──
  const rowClasses = (state: string) => {
    switch (state) {
      case 'overdue': return 'border-l-[3px] border-l-red-500 bg-red-50/40';
      case 'due-now': return 'border-l-[3px] border-l-amber-500 bg-amber-50/30';
      case 'snoozed': return 'border-l-[3px] border-l-blue-400 bg-blue-50/30';
      case 'completed': return 'opacity-60 border-l-[3px] border-l-green-400';
      default: return 'border-l-[3px] border-l-transparent';
    }
  };
  const statusBadge = (state: string) => {
    switch (state) {
      case 'overdue': return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-700">Overdue</span>;
      case 'due-now': return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 animate-pulse">Due now</span>;
      case 'snoozed': return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-600">Snoozed</span>;
      case 'completed': return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-green-100 text-green-700 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Done</span>;
      default: return null;
    }
  };

  return (
    <CommunicationPanel
      icon={<Phone size={16} />}
      iconBg="from-violet-500 to-violet-600"
      title="Followup & Reminders"
      subtitle={
        <>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${
            stats.due > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {stats.due} due
          </span>
          {stats.overdue > 0 && (
            <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
              {stats.overdue} overdue
            </span>
          )}
        </>
      }
      actions={
        permissions.canCreate ? (
          <button
            onClick={() => { setForm({ remarks: '', nextFollowupDate: '' }); setCreateOpen(true); }}
            className="p-1.5 px-2 bg-violet-100 text-violet-600 rounded-[10px] hover:bg-violet-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : undefined
      }
    >
      {/* Accordion list */}
      <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 font-bold">No followups logged yet.</p>
            {permissions.canCreate && <p className="text-[10px] text-slate-400 mt-1">Click "+ New" to create the first one.</p>}
          </div>
        ) : groups.map(g => {
          const isOpen = openGroups.has(g.createdBy);
          const name = empName(g.createdBy);
          return (
            <div key={g.createdBy} className="mb-2">
              {/* Group header */}
              <button onClick={() => toggleGroup(g.createdBy)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100/80 transition-colors group">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                {/* Avatar */}
                {empAvatar(g.createdBy) ? (
                  <Image src={empAvatar(g.createdBy)} alt={name} width={22} height={22} className="rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-[22px] h-[22px] rounded-full bg-violet-100 text-violet-600 text-[10px] font-black flex items-center justify-center shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-xs font-bold text-slate-800 truncate flex-1 text-left">{name}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-600 tabular-nums">{g.totalCount}</span>
                {g.dueCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 tabular-nums">{g.dueCount} due</span>}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="ml-3 pl-3 border-l border-slate-200 space-y-2 mt-1 mb-2">
                  {g.items.map((f: any) => {
                    const state = getRowState(f);
                    const isExpanded = expandedRemarks.has(f._id);
                    return (
                      <div key={f._id} className={`p-3 rounded-xl bg-white border border-slate-100 shadow-sm ${rowClasses(state)} transition-all`}>
                        {/* Row 1: Due Date/Time (big) or Completed Date + status badge */}
                        {f.status === 'completed' ? (
                          <div className="flex items-center gap-2 mb-2">
                            <Check className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-sm font-extrabold text-green-700 tabular-nums">{fmtShortDate(f.completedAt || f.followupDate)}</span>
                            <span className="flex-1" />
                            {statusBadge(state)}
                          </div>
                        ) : f.nextFollowupDate ? (
                          <div className="flex items-center gap-2 mb-2">
                            <AlarmClock className="w-4 h-4 text-slate-600 shrink-0" />
                            <span className="text-sm font-extrabold text-slate-800 tabular-nums">{fmtShortDate(f.nextFollowupDate)}</span>
                            <span className="flex-1" />
                            {statusBadge(state)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex-1" />
                            {statusBadge(state)}
                          </div>
                        )}

                        {/* Remarks */}
                        <p className={`text-[12px] text-slate-800 leading-relaxed font-medium ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {f.remarks}
                        </p>
                        {f.remarks?.length > 120 && !isExpanded && (
                          <button onClick={() => setExpandedRemarks(prev => { const n = new Set(prev); n.add(f._id); return n; })} className="text-[10px] text-violet-600 font-bold hover:underline mt-0.5">
                            more
                          </button>
                        )}

                        {/* Footer: createdDate + actions */}
                        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                          {/* Created date */}
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{fmtShortDate(f.followupDate)}</span>

                          <span className="flex-1" />

                          {/* Actions for open items */}
                          {permissions.canEdit && f.status !== 'completed' && (
                            <>
                              {/* Done = checkmark only */}
                              <button onClick={() => handleAction(f._id, 'complete')}
                                className="w-6 h-6 rounded-md flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Mark done">
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              {/* Snooze popover — rendered via portal to avoid overflow clipping */}
                              <button
                                ref={el => { if (snoozePopoverId === f._id) snoozeAnchorRef.current = el; }}
                                onClick={() => { setSnoozeCustomDate(''); setSnoozePopoverId(snoozePopoverId === f._id ? null : f._id); }}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">Snz</button>
                              {snoozePopoverId === f._id && (
                                <SnoozePortal
                                  anchorRef={snoozeAnchorRef}
                                  onClose={() => { setSnoozePopoverId(null); setSnoozeCustomDate(''); }}
                                  onSelect={(opt) => handleSnooze(f._id, opt)}
                                  onCustom={(dt) => handleSnooze(f._id, 'custom', dt)}
                                  customDate={snoozeCustomDate}
                                  setCustomDate={setSnoozeCustomDate}
                                />
                              )}

                              {/* Audit log toggle */}
                              <button onClick={() => setAuditExpandedId(auditExpandedId === f._id ? null : f._id)}
                                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors" title="Audit log">
                                <History className="w-3 h-3 text-slate-500" />
                              </button>

                              {/* More menu */}
                              <div className="relative">
                                <button onClick={() => setActionMenuId(actionMenuId === f._id ? null : f._id)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors">
                                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                                {actionMenuId === f._id && (
                                  <div className="absolute right-0 bottom-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                                    <button onClick={() => handleAction(f._id, 'reopen')} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 font-semibold">Reopen</button>
                                    {permissions.canDelete && (
                                      <button onClick={() => handleAction(f._id, 'delete')} className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 font-semibold">Delete</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Completed state — avatar + name */}
                          {f.status === 'completed' && (
                            <>
                              <span className="text-[10px] text-green-700 font-bold flex items-center gap-1">
                                {f.completedBy && empAvatar(f.completedBy) ? (
                                  <Image src={empAvatar(f.completedBy)} alt={empName(f.completedBy)} width={16} height={16} className="rounded-full object-cover shrink-0" />
                                ) : f.completedBy ? (
                                  <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[8px] font-black flex items-center justify-center shrink-0">
                                    {empName(f.completedBy).charAt(0).toUpperCase()}
                                  </span>
                                ) : null}
                                Completed {f.completedBy ? `by ${empName(f.completedBy)}` : ''}
                              </span>
                              <button onClick={() => setAuditExpandedId(auditExpandedId === f._id ? null : f._id)}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100 transition-colors" title="Audit log">
                                <History className="w-2.5 h-2.5 text-slate-500" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Audit log entries — darker text */}
                        {auditExpandedId === f._id && f.auditLog?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-1">Audit Trail</p>
                            {(f.auditLog as any[]).map((entry: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[10px]">
                                <span className="text-slate-500 tabular-nums shrink-0">{fmtShortDate(entry.at)}</span>
                                <span className={`font-bold shrink-0 ${entry.action === 'completed' ? 'text-green-700' : entry.action === 'reminded' ? 'text-amber-700' : entry.action === 'snoozed' ? 'text-blue-700' : 'text-slate-700'}`}>{entry.action}</span>
                                <span className="text-slate-600 truncate">{entry.by === 'system' ? '⚙️ system' : empName(entry.by)}{entry.details ? ` — ${entry.details}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Followup">
        <div className="space-y-4">
          {/* 9.1 — Smart suggestion chips */}
          <SuggestionChips estimateNumber={estimateNumber} customerId={customerId} createOpen={createOpen}
            onSelect={(s: any) => setForm(p => ({ ...p, remarks: s.remarks }))} />

          {/* Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Remarks <span className="text-red-400">*</span></label>
            <textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} rows={3} placeholder="What was discussed?"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-violet-300 outline-none resize-none" />
          </div>

          {/* Next followup date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Next Followup Date</label>
            <input type="datetime-local" value={form.nextFollowupDate} onChange={e => setForm(p => ({ ...p, nextFollowupDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.remarks.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Followup'}
            </Button>
          </div>
        </div>
      </Modal>
    </CommunicationPanel>
  );
};

// ── 9.1 Smart Suggestion Chips (sub-component) ──
const SuggestionChips: React.FC<{
  estimateNumber: string; customerId?: string; createOpen: boolean;
  onSelect: (s: any) => void;
}> = ({ estimateNumber, customerId, createOpen, onSelect }) => {
  const key = createOpen
    ? `/api/followups/suggest?estimateNumber=${encodeURIComponent(estimateNumber)}${customerId ? `&customerId=${encodeURIComponent(customerId)}` : ''}`
    : null;
  const { data } = useSWR(key, (u: string) => fetch(u).then(r => r.json()), { dedupingInterval: 30000 });

  const suggestions = data?.suggestions || [];
  const meta = data?.meta;
  if (!data?.success || suggestions.length === 0) return null;

  return (
    <div>
      {/* 9.5 — Stats line */}
      {meta && (
        <p className="text-[10px] text-slate-400 font-bold mb-1.5">
          {meta.daysSinceContact >= 0 && <span>Last contact {meta.daysSinceContact}d ago</span>}
          {meta.avgResponseDays >= 0 && <span> · Avg resolution {meta.avgResponseDays}d</span>}
          {meta.topChannel && <span> · Prefers {meta.topChannel}</span>}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s: any, i: number) => (
          <button key={i} onClick={() => onSelect(s)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/50 transition-colors flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />{s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Snooze Portal (renders outside overflow containers) ──
const SnoozePortal: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelect: (opt: string) => void;
  onCustom: (dt: string) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
}> = ({ anchorRef, onClose, onSelect, onCustom, customDate, setCustomDate }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [showCustom, setShowCustom] = useState(false);

  // Calculate position from anchor button
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    // Position above the button
    setPos({
      top: rect.top - 8,
      left: rect.left,
    });
  }, [anchorRef]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
    >
      <p className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-wider">Snooze until</p>
      {[
        { key: '1h', label: '1 hour' },
        { key: '4h', label: '4 hours' },
        { key: 'tomorrow', label: 'Tomorrow 8 AM' },
        { key: 'monday', label: 'Next Monday' },
      ].map(opt => (
        <button key={opt.key} onClick={() => onSelect(opt.key)}
          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-blue-50 font-semibold transition-colors">{opt.label}</button>
      ))}
      <div className="border-t border-slate-100 mt-1 pt-1">
        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-1.5 text-[11px] text-violet-700 hover:bg-violet-50 font-semibold transition-colors">
            Custom date & time…
          </button>
        ) : (
          <div className="px-3 py-2 space-y-2">
            <input
              type="datetime-local"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:ring-2 focus:ring-violet-300 outline-none"
              autoFocus
            />
            <button
              onClick={() => { if (customDate) onCustom(customDate); }}
              disabled={!customDate}
              className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Snooze
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FollowupReminders;
