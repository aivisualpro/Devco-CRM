'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, ChevronDown, Check, MapPin, X, Upload, Drill } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button, Input, MyDropDown } from '@/components/ui';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { usePermissions } from '@/hooks/usePermissions';
import { useAllEmployees } from '@/lib/hooks/api';
import { formatWallDate } from '@/lib/format/date';
import { cld } from '@/lib/cld';

export interface PreBoreLogItemData {
    _id?: string;
    rodNumber: string;
    distance: string;
    topDepth: string;
    bottomDepth: string;
    overOrUnder: string;
    existingUtilities: string;
    picture?: string;
    createdBy?: string;
}

export interface PreBoreLogData {
    _id?: string;
    legacyId?: string;
    estimate?: string;
    customerId?: string;
    date: string;
    customerForeman: string;
    customerWorkRequestNumber: string;
    startTime: string;
    addressBoreStart: string;
    addressBoreEnd: string;
    devcoOperator: string;
    drillSize: string;
    pilotBoreSize: string;
    reamers: string;
    soilType: string;
    boreLength: string;
    pipeSize: string;
    foremanSignature: string;
    customerName: string;
    customerSignature: string;
    preBoreLogs: PreBoreLogItemData[];
    createdBy?: string;
    scheduleCustomerName?: string;
}

export interface EstimateOption {
    _id: string;
    estimate?: string;
    projectName?: string;
    jobAddress?: string;
    customerName?: string;
    contactName?: string;
    customer?: string;
}

export interface ClientOption {
    _id: string;
    name: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    editingLog?: any;
    defaultEstimate?: EstimateOption | null;
    estimates?: EstimateOption[];
    clients?: ClientOption[];
    onSaved?: (log: PreBoreLogData) => void;
}

const SOIL_TYPES = ['Base & Sand', 'Clay', 'Dirt Backfill', 'Hard Clay', 'Loamy', 'Rocky', 'Sandy', 'Slurry', 'Tight Sand'];
const REAMER_OPTIONS = Array.from({ length: 60 }, (_, i) => ({ id: String(i + 1), label: `${i + 1}"`, value: String(i + 1) }));

export function PreBoreLogFormModal({ open, onClose, editingLog, defaultEstimate, estimates = [], clients = [], onSaved }: Props) {
    const { user } = usePermissions();
    const { employees } = useAllEmployees();

    const [saving, setSaving] = useState(false);
    
    // Cascading state
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedEstimateId, setSelectedEstimateId] = useState('');
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Form data
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        customerForeman: '',
        customerWorkRequestNumber: '',
        startTime: '',
        addressBoreStart: '',
        addressBoreEnd: '',
        devcoOperator: '',
        drillSize: '',
        pilotBoreSize: '',
        reamers: '',
        soilType: '',
        boreLength: '',
        pipeSize: '',
        foremanSignature: '',
        customerName: '',
        customerSignature: '',
        preBoreLogs: [] as PreBoreLogItemData[]
    });

    const [customSoilTypes, setCustomSoilTypes] = useState<string[]>([]);
    const [uploadingItems, setUploadingItems] = useState<Record<number, number>>({});
    const [geoLoadingField, setGeoLoadingField] = useState<'start' | 'end' | null>(null);

    useEffect(() => {
        if (!open) return;
        if (editingLog) {
            const matchedClient = 
                (editingLog.customerId && clients.find(c => String(c._id) === String(editingLog.customerId))) 
                || clients.find(c => c.name?.toLowerCase() === (editingLog.scheduleCustomerName || editingLog.customerName || '').toLowerCase());
            
            setSelectedCustomerId(matchedClient?._id || '');
            setSelectedEstimateId(editingLog.estimate || '');

            const buildDateTimeLocal = () => {
                const dateStr = editingLog.date ? formatWallDate(editingLog.date) : format(new Date(), 'yyyy-MM-dd');
                if (editingLog.startTime && editingLog.startTime.includes('T')) return editingLog.startTime.slice(0, 16);
                if (editingLog.startTime) {
                    const match = editingLog.startTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                    if (match) {
                        let hours = parseInt(match[1]);
                        const mins = match[2].padStart(2, '0');
                        const ampm = match[3]?.toUpperCase();
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        return `${dateStr}T${hours.toString().padStart(2, '0')}:${mins}`;
                    }
                }
                return `${dateStr}T00:00`;
            };

            setFormData({
                date: editingLog.date ? formatWallDate(editingLog.date) : '',
                customerForeman: editingLog.customerForeman || '',
                customerWorkRequestNumber: editingLog.customerWorkRequestNumber || '',
                startTime: buildDateTimeLocal(),
                addressBoreStart: editingLog.addressBoreStart || '',
                addressBoreEnd: editingLog.addressBoreEnd || '',
                devcoOperator: editingLog.devcoOperator || '',
                drillSize: editingLog.drillSize || '',
                pilotBoreSize: editingLog.pilotBoreSize || '',
                reamers: editingLog.reamers || '',
                soilType: editingLog.soilType || '',
                boreLength: editingLog.boreLength || '',
                pipeSize: editingLog.pipeSize || '',
                foremanSignature: editingLog.foremanSignature || '',
                customerName: editingLog.customerName || '',
                customerSignature: editingLog.customerSignature || '',
                preBoreLogs: editingLog.preBoreLogs || []
            });
        } else {
            setSelectedEstimateId(defaultEstimate?.estimate || defaultEstimate?._id || '');
            const defaultCustomer = clients.find(c => c.name === defaultEstimate?.customerName) || clients.find(c => c.name === defaultEstimate?.contactName);
            setSelectedCustomerId(defaultCustomer?._id || '');

            setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                customerForeman: '',
                customerWorkRequestNumber: defaultEstimate?.jobAddress || '',
                startTime: `${format(new Date(), 'yyyy-MM-dd')}T08:00`,
                addressBoreStart: '',
                addressBoreEnd: '',
                devcoOperator: '',
                drillSize: '',
                pilotBoreSize: '',
                reamers: '',
                soilType: '',
                boreLength: '',
                pipeSize: '',
                foremanSignature: '',
                customerName: defaultEstimate?.customerName || defaultEstimate?.contactName || '',
                customerSignature: '',
                preBoreLogs: []
            });
        }
        setOpenDropdownId(null);
    }, [open, editingLog, defaultEstimate, clients]);

    // Dropdown Options
    const clientOptions = useMemo(() => {
        return clients.filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ id: c._id, label: c.name, value: c._id }));
    }, [clients]);

    const estimateOptions = useMemo(() => {
        const selectedClientName = clients.find(c => c._id === selectedCustomerId)?.name?.toLowerCase().trim() || '';
        const uniqueMap: Record<string, EstimateOption> = {};
        estimates.forEach(est => {
            const num = est.estimate;
            if (!num) return;
            if (selectedCustomerId && selectedClientName) {
                const estCust = (est.customerName || est.customer || '').toLowerCase().trim();
                if (!estCust) return;
                const matches = estCust.includes(selectedClientName) || selectedClientName.includes(estCust);
                if (!matches) return;
            }
            if (!uniqueMap[num]) uniqueMap[num] = est;
        });
        return Object.values(uniqueMap).sort((a, b) => (b.estimate || '').localeCompare(a.estimate || '')).map(est => ({
            id: est._id,
            label: `${est.estimate || 'No #'} - ${est.projectName || 'Untitled'}`,
            value: est.estimate || est._id
        }));
    }, [estimates, selectedCustomerId, clients]);

    const employeeOptions = useMemo(() => {
        return employees.filter(e => e.firstName || e.lastName).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)).map(e => ({
            id: e.email, label: `${e.firstName || ''} ${e.lastName || ''}`.trim(), value: `${e.firstName || ''} ${e.lastName || ''}`.trim(), profilePicture: e.profilePicture || ''
        }));
    }, [employees]);

    const handleDropPinAddress = (field: 'addressBoreStart' | 'addressBoreEnd') => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setGeoLoadingField(field === 'addressBoreStart' ? 'start' : 'end');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                    const data = await res.json();
                    const address = data?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    setFormData(p => ({ ...p, [field]: address }));
                    toast.success('📍 Location pinned!');
                } catch {
                    setFormData(p => ({ ...p, [field]: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
                    toast.success('📍 Location pinned (coordinates)');
                }
                setGeoLoadingField(null);
            },
            (err) => { setGeoLoadingField(null); toast.error(err.message); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handlePhotoUpload = async (index: number, files: FileList | null) => {
        if (!files || !files.length) return;
        const fileArr = Array.from(files);
        setUploadingItems(prev => ({ ...prev, [index]: (prev[index] || 0) + fileArr.length }));
        for (const file of fileArr) {
            const fd = new FormData(); fd.append('file', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success && data.url) {
                    setFormData(prev => {
                        const updated = [...prev.preBoreLogs];
                        const pics = updated[index].picture ? updated[index].picture!.split(',').filter(Boolean) : [];
                        pics.push(data.url);
                        updated[index] = { ...updated[index], picture: pics.join(',') };
                        return { ...prev, preBoreLogs: updated };
                    });
                }
            } catch { toast.error(`Failed to upload ${file.name}`); }
            finally { setUploadingItems(p => { const count = (p[index] || 1) - 1; if (count <= 0) { const { [index]: _, ...rest } = p; return rest; } return { ...p, [index]: count }; }); }
        }
    };

    const handleSave = async () => {
        if (!editingLog && (!selectedCustomerId || !selectedEstimateId) && !defaultEstimate) {
            toast.error('Please select an estimate');
            return;
        }

        setSaving(true);
        try {
            let foremanSigUrl = formData.foremanSignature;
            let customerSigUrl = formData.customerSignature;

            if (foremanSigUrl && foremanSigUrl.startsWith('data:')) {
                try {
                    const sigRes = await fetch('/api/upload-signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: foremanSigUrl }) });
                    const sigData = await sigRes.json();
                    if (sigData.success && sigData.url) foremanSigUrl = sigData.url;
                } catch { }
            }

            if (customerSigUrl && customerSigUrl.startsWith('data:')) {
                try {
                    const sigRes = await fetch('/api/upload-signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: customerSigUrl }) });
                    const sigData = await sigRes.json();
                    if (sigData.success && sigData.url) customerSigUrl = sigData.url;
                } catch { }
            }

            const payload = {
                estimate: selectedEstimateId || defaultEstimate?.estimate || defaultEstimate?._id || '',
                customerId: selectedCustomerId || '',
                date: formData.date ? new Date(formData.date) : new Date(),
                customerForeman: formData.customerForeman,
                customerWorkRequestNumber: formData.customerWorkRequestNumber,
                startTime: formData.startTime,
                addressBoreStart: formData.addressBoreStart,
                addressBoreEnd: formData.addressBoreEnd,
                devcoOperator: formData.devcoOperator,
                drillSize: formData.drillSize,
                pilotBoreSize: formData.pilotBoreSize,
                reamers: formData.reamers,
                soilType: formData.soilType,
                boreLength: formData.boreLength,
                pipeSize: formData.pipeSize,
                foremanSignature: foremanSigUrl,
                customerName: formData.customerName,
                customerSignature: customerSigUrl,
                preBoreLogs: formData.preBoreLogs,
                createdBy: editingLog?.createdBy || user?.email,
                legacyId: editingLog?.legacyId
            };

            const action = editingLog ? 'updatePreBoreLog' : 'createPreBoreLog';
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload: editingLog ? { id: editingLog._id, item: payload } : { item: payload } })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingLog ? 'Pre-Bore Log updated' : 'Pre-Bore Log created');
                onSaved?.(result.result);
                onClose();
            } else {
                toast.error(result.error || 'Failed to save');
            }
        } catch {
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const isLocked = !!defaultEstimate || !!editingLog;

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>{editingLog ? 'Edit Pre-Bore Log' : 'New Pre-Bore Log'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* Cascading selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {!isLocked ? (
                                <>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer *</Label>
                                        <div className="relative mt-1">
                                            <div className="w-full flex items-center justify-between px-3 py-2.5 border rounded-xl cursor-pointer bg-white hover:border-slate-400" onClick={() => setOpenDropdownId(openDropdownId === 'customer' ? null : 'customer')}>
                                                <span className={`text-sm truncate ${selectedCustomerId ? 'text-slate-900' : 'text-slate-400'}`}>{selectedCustomerId ? (clients.find(c => c._id === selectedCustomerId)?.name || 'Selected') : 'Select Customer...'}</span>
                                                <ChevronDown size={16} className="text-slate-400" />
                                            </div>
                                            {openDropdownId === 'customer' && <MyDropDown isOpen={true} onClose={() => setOpenDropdownId(null)} options={clientOptions} selectedValues={selectedCustomerId ? [selectedCustomerId] : []} onSelect={v => { const n = v === selectedCustomerId ? '' : v; setSelectedCustomerId(n); setSelectedEstimateId(''); const c = clients.find(cl => cl._id === n); if (c) setFormData(p => ({ ...p, customerName: c.name })); setOpenDropdownId(null); }} width="w-full" placeholder="Search..." />}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimate *</Label>
                                        <div className="relative mt-1">
                                            <div className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-xl ${!selectedCustomerId ? 'bg-slate-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-slate-400'}`} onClick={() => { if (selectedCustomerId) setOpenDropdownId(openDropdownId === 'estimate' ? null : 'estimate'); }}>
                                                <span className={`text-sm truncate ${selectedEstimateId ? 'text-slate-900' : 'text-slate-400'}`}>{selectedEstimateId || 'Select Estimate...'}</span>
                                                <ChevronDown size={16} className="text-slate-400" />
                                            </div>
                                            {openDropdownId === 'estimate' && selectedCustomerId && <MyDropDown isOpen={true} onClose={() => setOpenDropdownId(null)} options={estimateOptions} selectedValues={selectedEstimateId ? [selectedEstimateId] : []} onSelect={v => { const n = v === selectedEstimateId ? '' : v; setSelectedEstimateId(n); setOpenDropdownId(null); }} width="w-full" placeholder="Search..." />}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</Label>
                                        <div className="mt-1 px-3 py-2 border rounded-xl bg-slate-50 text-sm font-medium text-slate-700">{formData.customerName || '—'}</div>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimate</Label>
                                        <div className="mt-1 px-3 py-2 border rounded-xl bg-slate-50 text-sm font-medium text-slate-700">{selectedEstimateId || defaultEstimate?.estimate || '—'}</div>
                                    </div>
                                </>
                            )}
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Location</Label>
                                <Input value={formData.customerWorkRequestNumber} onChange={e => setFormData(p => ({ ...p, customerWorkRequestNumber: e.target.value }))} className="mt-1" />
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date &amp; Time</Label>
                                <Input type="datetime-local" value={formData.startTime} onChange={e => setFormData(p => ({ ...p, startTime: e.target.value, date: e.target.value.split('T')[0] }))} className="mt-1" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Devco Operator</Label>
                                <div className="relative mt-1">
                                    <div className="w-full flex items-center justify-between px-3 py-2.5 border rounded-xl cursor-pointer bg-white" onClick={() => setOpenDropdownId(openDropdownId === 'op' ? null : 'op')}>
                                        <span className={`text-sm ${formData.devcoOperator ? 'text-slate-900' : 'text-slate-400'}`}>{formData.devcoOperator || 'Select...'}</span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </div>
                                    {openDropdownId === 'op' && <MyDropDown isOpen={true} onClose={() => setOpenDropdownId(null)} options={employeeOptions} selectedValues={formData.devcoOperator ? [formData.devcoOperator] : []} onSelect={v => { setFormData(p => ({ ...p, devcoOperator: v })); setOpenDropdownId(null); }} width="w-full" placeholder="Search..." />}
                                </div>
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Foreman</Label>
                                <Input value={formData.customerForeman} onChange={e => setFormData(p => ({ ...p, customerForeman: e.target.value }))} className="mt-1" />
                            </div>
                        </div>

                        {/* Addresses */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address Bore Start</Label>
                                <div className="relative mt-1">
                                    <Input value={formData.addressBoreStart} onChange={e => setFormData(p => ({ ...p, addressBoreStart: e.target.value }))} className="pr-10" />
                                    <button type="button" onClick={() => handleDropPinAddress('addressBoreStart')} disabled={geoLoadingField === 'start'} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                        {geoLoadingField === 'start' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address Bore End</Label>
                                <div className="relative mt-1">
                                    <Input value={formData.addressBoreEnd} onChange={e => setFormData(p => ({ ...p, addressBoreEnd: e.target.value }))} className="pr-10" />
                                    <button type="button" onClick={() => handleDropPinAddress('addressBoreEnd')} disabled={geoLoadingField === 'end'} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                        {geoLoadingField === 'end' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bore Specs */}
                        <div className="border-t border-slate-100 pt-4">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3"><Drill size={12} /> Bore Specifications</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div><Label className="text-[9px] text-slate-400">Drill Size</Label><Input value={formData.drillSize} onChange={e => setFormData(p => ({ ...p, drillSize: e.target.value }))} className="h-9 text-xs mt-0.5" /></div>
                                <div><Label className="text-[9px] text-slate-400">Pilot Bore Size</Label><Input value={formData.pilotBoreSize} onChange={e => setFormData(p => ({ ...p, pilotBoreSize: e.target.value }))} className="h-9 text-xs mt-0.5" /></div>
                                <div><Label className="text-[9px] text-slate-400">Bore Length</Label><Input value={formData.boreLength} onChange={e => setFormData(p => ({ ...p, boreLength: e.target.value }))} className="h-9 text-xs mt-0.5" /></div>
                                <div><Label className="text-[9px] text-slate-400">Pipe Size</Label><Input value={formData.pipeSize} onChange={e => setFormData(p => ({ ...p, pipeSize: e.target.value }))} className="h-9 text-xs mt-0.5" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                <div>
                                    <Label className="text-[9px] text-slate-400">Reamer(s)</Label>
                                    <div className="relative mt-0.5">
                                        <div className="w-full flex items-center justify-between px-3 py-2 border rounded-xl bg-white" onClick={() => setOpenDropdownId(openDropdownId === 'reamers' ? null : 'reamers')}>
                                            <span className="text-sm">{formData.reamers ? formData.reamers.split(',').filter(Boolean).map(s => `${s.trim()}"`).join(', ') : 'Select...'}</span>
                                        </div>
                                        {openDropdownId === 'reamers' && <MyDropDown isOpen={true} onClose={() => setOpenDropdownId(null)} options={REAMER_OPTIONS} selectedValues={formData.reamers ? formData.reamers.split(',').map(s => s.trim()).filter(Boolean) : []} onSelect={v => { const c = formData.reamers ? formData.reamers.split(',').map(s => s.trim()).filter(Boolean) : []; const e = c.indexOf(v); setFormData(p => ({ ...p, reamers: (e >= 0 ? c.filter(x => x !== v) : [...c, v]).join(', ') })); }} multiSelect={true} />}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">Soil Type</Label>
                                    <div className="relative mt-0.5">
                                        <div className="w-full flex items-center justify-between px-3 py-2 border rounded-xl bg-white" onClick={() => setOpenDropdownId(openDropdownId === 'soilType' ? null : 'soilType')}>
                                            <span className="text-sm">{formData.soilType || 'Select...'}</span>
                                        </div>
                                        {openDropdownId === 'soilType' && <MyDropDown isOpen={true} onClose={() => setOpenDropdownId(null)} options={[...SOIL_TYPES.map(t => ({ id: t, label: t, value: t })), ...customSoilTypes.filter(t => !SOIL_TYPES.includes(t)).map(t => ({ id: t, label: t, value: t }))]} selectedValues={formData.soilType ? formData.soilType.split(',').map(s => s.trim()).filter(Boolean) : []} onSelect={v => { const c = formData.soilType ? formData.soilType.split(',').map(s => s.trim()).filter(Boolean) : []; const e = c.indexOf(v); setFormData(p => ({ ...p, soilType: (e >= 0 ? c.filter(x => x !== v) : [...c, v]).join(', ') })); }} onAdd={async (s) => { const t = s.trim(); if (t && !SOIL_TYPES.includes(t)) setCustomSoilTypes(p => [...p, t]); const c = formData.soilType ? formData.soilType.split(',').map(x => x.trim()).filter(Boolean) : []; setFormData(p => ({ ...p, soilType: [...c, t].join(', ') })); }} multiSelect={true} />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rod Log Items */}
                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rod Log Items</Label>
                                <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({ ...p, preBoreLogs: [...p.preBoreLogs, { rodNumber: '', distance: '', topDepth: '', bottomDepth: '', overOrUnder: '', existingUtilities: '', picture: '', createdBy: user?.email || '' }] }))}><Plus size={14} className="mr-1" /> Add Rod</Button>
                            </div>
                            {formData.preBoreLogs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm border border-dashed rounded-xl">No items.</div>
                            ) : (
                                <div className="space-y-3">
                                    {formData.preBoreLogs.map((item, idx) => (
                                        <div key={idx} className="border rounded-xl p-3 bg-slate-50 relative">
                                            <button onClick={() => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.filter((_, i) => i !== idx) }))} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X size={16} /></button>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                <div><Label className="text-[9px] text-slate-400">Rod #</Label><Input value={item.rodNumber} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, rodNumber: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] text-slate-400">Distance</Label><Input value={item.distance} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, distance: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] text-slate-400">Top Depth</Label><Input value={item.topDepth} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, topDepth: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] text-slate-400">Bottom Depth</Label><Input value={item.bottomDepth} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, bottomDepth: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] text-slate-400">Over / Under</Label><Input value={item.overOrUnder} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, overOrUnder: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] text-slate-400">Existing Utilities</Label><Input value={item.existingUtilities} onChange={e => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, existingUtilities: e.target.value } : it) }))} className="h-8 text-xs" /></div>
                                                <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                                                    <Label className="text-[9px] text-slate-400">Pictures</Label>
                                                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                        {item.picture?.split(',').filter(Boolean).map((pic, pIdx) => (
                                                            <div key={pIdx} className="relative group w-14 h-14 rounded-lg overflow-hidden border">
                                                                <img src={pic} className="w-full h-full object-cover" />
                                                                <button onClick={() => setFormData(p => ({ ...p, preBoreLogs: p.preBoreLogs.map((it, i) => i === idx ? { ...it, picture: it.picture!.split(',').filter((_, pi) => pi !== pIdx).join(',') } : it) }))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px]"><X size={10}/></button>
                                                            </div>
                                                        ))}
                                                        {uploadingItems[idx] && <Loader2 size={16} className="animate-spin text-blue-500" />}
                                                        <label className="w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer text-slate-400 hover:text-blue-500">
                                                            <Upload size={16} />
                                                            <input type="file" multiple className="hidden" onChange={e => handlePhotoUpload(idx, e.target.files)} />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Signatures */}
                        <div className="border-t border-slate-100 pt-4">
                            <div className="mb-4">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Name</Label>
                                <Input value={formData.customerName} onChange={e => setFormData(p => ({ ...p, customerName: e.target.value }))} className="mt-1 max-w-md" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SignaturePad value={formData.foremanSignature} onChange={v => setFormData(p => ({ ...p, foremanSignature: v }))} label="Foreman Signature" />
                                <SignaturePad value={formData.customerSignature} onChange={v => setFormData(p => ({ ...p, customerSignature: v }))} label="Customer Signature" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white">
                        {saving ? 'Saving...' : (editingLog ? 'Update' : 'Create')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
