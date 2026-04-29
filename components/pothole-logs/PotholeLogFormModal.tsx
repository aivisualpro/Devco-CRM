'use client';

import Image from 'next/image';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, ChevronDown, Check, MapPin, X, Upload, LocateFixed } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cld } from '@/lib/cld';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button, Input, MyDropDown } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

// ── Types ──────────────────────────────────────────────────────────────────
export interface PotholeItemData {
    _id?: string;
    potholeNo: string;
    typeOfUtility: string;
    soilType: string;
    topDepthOfUtility: string;
    bottomDepthOfUtility: string;
    photos?: string[];
    photo1?: string;
    photo2?: string;
    latitude?: string;
    longitude?: string;
    pin?: string;
    createdBy?: string;
}

export interface PotholeLogData {
    _id?: string;
    date: string;
    estimate: string;
    customerName?: string;
    jobAddress?: string;
    projectionLocation?: string;
    potholeItems: PotholeItemData[];
    createdBy?: string;
}

export interface EstimateOption {
    _id: string;
    estimate?: string;
    projectName?: string;
    jobAddress?: string;
    customerName?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** When editing an existing log */
    editingLog?: PotholeLogData | null;
    /** Pre-seed from the estimate context (skips customer→estimate cascade) */
    defaultEstimate?: EstimateOption | null;
    /** Full estimates list for Customer→Estimate cascade (not needed when defaultEstimate is set) */
    estimates?: EstimateOption[];
    onSaved?: (log: PotholeLogData) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const UTILITY_TYPES = ['Electrical','Communication','Gas','Water','Sewer','Storm Drain','Fiber Optic','Cable/TV','Unknown','Other'];
const SOIL_TYPES = ['Base & Sand','Clay','Dirt Backfill','Hard Clay','Loamy','Rocky','Sandy','Slurry','Tight Sand'];

/** Convert any date string to yyyy-MM-dd for <input type="date"> — handles ISO UTC/local/plain strings */
function toInputDate(raw: string | undefined | null): string {
    if (!raw) return format(new Date(), 'yyyy-MM-dd');
    // Already plain yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return format(new Date(), 'yyyy-MM-dd');
        // Use local year/month/day to avoid UTC→local day-shift
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch {
        return format(new Date(), 'yyyy-MM-dd');
    }
}

async function extractGPS(file: File) {
    try {
        const exifr = (await import('exifr')).default;
        const gps = await exifr.gps(file);
        return gps?.latitude && gps?.longitude ? { latitude: gps.latitude, longitude: gps.longitude } : null;
    } catch { return null; }
}

// ── Component ──────────────────────────────────────────────────────────────
export function PotholeLogFormModal({ open, onClose, editingLog, defaultEstimate, estimates = [], onSaved }: Props) {
    const { user } = usePermissions();

    // Form state
    const [formData, setFormData] = useState({ date: format(new Date(), 'yyyy-MM-dd'), jobAddress: '', potholeItems: [] as PotholeItemData[] });
    const [saving, setSaving] = useState(false);

    // Customer→Estimate cascade (only used when no defaultEstimate)
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerOpen, setIsCustomerOpen] = useState(false);
    const [selectedEstimateId, setSelectedEstimateId] = useState('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isEstimateOpen, setIsEstimateOpen] = useState(false);

    // Per-item dropdowns / geo
    const [utilityOpen, setUtilityOpen] = useState<Record<number, boolean>>({});
    const [soilOpen, setSoilOpen] = useState<Record<number, boolean>>({});
    const [utilityOptions, setUtilityOptions] = useState(UTILITY_TYPES);
    const [soilOptions, setSoilOptions] = useState(SOIL_TYPES);
    const [geoLoading, setGeoLoading] = useState<number | null>(null);
    const [uploadingItems, setUploadingItems] = useState<Record<number, boolean>>({});

    // Seed form when modal opens
    useEffect(() => {
        if (!open) return;
        if (editingLog) {
            const items = (editingLog.potholeItems || []).map(it => ({
                ...it,
                photos: [...(it.photos || []), ...(it.photo1 ? [it.photo1] : []), ...(it.photo2 ? [it.photo2] : [])].filter((v,i,a)=>a.indexOf(v)===i),
                latitude: it.latitude?.toString() || '',
                longitude: it.longitude?.toString() || '',
            }));
            setFormData({ date: toInputDate(editingLog.date), jobAddress: editingLog.jobAddress || editingLog.projectionLocation || '', potholeItems: items });
            setSelectedEstimateId(editingLog.estimate || '');
            // Try to resolve customer from editingLog, or from matched estimate
            const matchedEst = estimates.find(e => e._id === editingLog.estimate || e.estimate === editingLog.estimate);
            setSelectedCustomer(editingLog.customerName || matchedEst?.customerName || '');
        } else {
            setFormData({ date: format(new Date(),'yyyy-MM-dd'), jobAddress: defaultEstimate?.jobAddress || '', potholeItems: [] });
            setSelectedEstimateId(defaultEstimate?._id || '');
            setSelectedCustomer(defaultEstimate?.customerName || '');
            setEstimateSearch('');
            setCustomerSearch('');
        }
    }, [open, editingLog, defaultEstimate]);

    // Derived lists for cascade
    const allCustomers = useMemo(() => {
        const seen = new Set<string>();
        const list: string[] = [];
        estimates.forEach(e => { const n=(e.customerName||'').trim(); if(n&&!seen.has(n)){seen.add(n);list.push(n);} });
        return list.sort((a,b)=>a.localeCompare(b));
    }, [estimates]);

    const filteredCustomers = useMemo(() => {
        const s = customerSearch.toLowerCase();
        return s ? allCustomers.filter(c=>c.toLowerCase().includes(s)) : allCustomers;
    }, [allCustomers, customerSearch]);

    const filteredEstimates = useMemo(() => {
        const map: Record<string,EstimateOption> = {};
        estimates.forEach(e => {
            if (!e.estimate) return;
            if (selectedCustomer && (e.customerName||'').trim() !== selectedCustomer) return;
            if (!map[e.estimate]) map[e.estimate] = e;
        });
        let res = Object.values(map);
        if (estimateSearch) res = res.filter(e=>(e.estimate||'').toLowerCase().includes(estimateSearch.toLowerCase())||(e.projectName||'').toLowerCase().includes(estimateSearch.toLowerCase()));
        return res.sort((a,b)=>(b.estimate||'').localeCompare(a.estimate||'')).slice(0,50);
    }, [estimates, estimateSearch, selectedCustomer]);

    const selectedEstimateObj = useMemo(() =>
        defaultEstimate || estimates.find(e=>e._id===selectedEstimateId||e.estimate===selectedEstimateId),
    [defaultEstimate, estimates, selectedEstimateId]);

    // ── Item helpers ──────────────────────────────────────────────────────
    const addItem = () => setFormData(p=>({...p, potholeItems:[...p.potholeItems,{potholeNo:'',typeOfUtility:'',soilType:'',topDepthOfUtility:'',bottomDepthOfUtility:'',photos:[],latitude:'',longitude:'',createdBy:user?.email||''}]}));
    const removeItem = (i:number) => setFormData(p=>({...p,potholeItems:p.potholeItems.filter((_,idx)=>idx!==i)}));
    const changeItem = (i:number,field:keyof PotholeItemData,val:string|string[]) => setFormData(p=>({...p,potholeItems:p.potholeItems.map((it,idx)=>idx===i?{...it,[field]:val}:it)}));

    const uploadPhotos = async (i:number, files:FileList|null) => {
        if (!files||!files.length) return;
        setUploadingItems(prev => ({...prev, [i]: true}));
        const urls: string[] = [];
        let gps: {latitude:number;longitude:number}|null = null;
        for (let f=0;f<files.length;f++){
            if (!gps&&!formData.potholeItems[i]?.latitude) gps = await extractGPS(files[f]);
            const fd = new FormData(); fd.append('file',files[f]);
            try { const r=await fetch('/api/upload',{method:'POST',body:fd}); const d=await r.json(); if(d.success&&d.url) urls.push(d.url); }
            catch { toast.error(`Upload failed: ${files[f].name}`); }
        }
        setFormData(p=>({...p,potholeItems:p.potholeItems.map((it,idx)=>idx===i?{...it,photos:[...(it.photos||[]),...urls],...(gps?{latitude:gps!.latitude.toFixed(6),longitude:gps!.longitude.toFixed(6)}:{})}:it)}));
        if (gps) toast.success('📍 GPS extracted from photo!');
        setUploadingItems(prev => ({...prev, [i]: false}));
    };

    const dropPin = (i:number) => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setGeoLoading(i);
        navigator.geolocation.getCurrentPosition(
            p=>{ changeItem(i,'latitude',p.coords.latitude.toFixed(6)); changeItem(i,'longitude',p.coords.longitude.toFixed(6)); setGeoLoading(null); toast.success('📍 Location pinned!'); },
            e=>{ setGeoLoading(null); toast.error(e.message); },
            {enableHighAccuracy:true,timeout:10000}
        );
    };

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!selectedEstimateId && !defaultEstimate) { toast.error('Please select an estimate'); return; }
        setSaving(true);
        try {
            const estId = defaultEstimate?._id || selectedEstimateId;
            const payload = {
                date: formData.date ? new Date(formData.date) : new Date(),
                estimate: estId,
                jobAddress: formData.jobAddress,
                potholeItems: formData.potholeItems.map(it=>({...it,latitude:it.latitude?parseFloat(it.latitude):undefined,longitude:it.longitude?parseFloat(it.longitude):undefined})),
                createdBy: editingLog?.createdBy || user?.email,
            };
            const action = editingLog ? 'updatePotholeLog' : 'createPotholeLog';
            const res = await fetch('/api/pothole-logs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:editingLog?{id:editingLog._id,item:payload}:{item:payload}})});
            const result = await res.json();
            if (result.success) {
                toast.success(editingLog ? 'Pothole Log updated' : 'Pothole Log created');
                onSaved?.(result.result);
                onClose();
            } else { toast.error(result.error||'Failed to save'); }
        } catch { toast.error('An error occurred'); }
        finally { setSaving(false); }
    };

    // Locked when: estimate pre-seeded from outside (estimate page) OR when editing an existing log
    // In both cases we don't need the customer→estimate cascade
    const isLocked = !!defaultEstimate || !!editingLog;

    // The estimate label to show in locked mode
    const lockedEstimateLabel = defaultEstimate
        ? `${defaultEstimate.estimate || ''} — ${defaultEstimate.projectName || defaultEstimate.jobAddress || ''}`.replace(/^— |— $/, '')
        : editingLog
        ? editingLog.estimate
        : '';

    return (
        <Dialog open={open} onOpenChange={v=>!v&&onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">{editingLog ? 'Edit Pothole Log' : 'New Pothole Log'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    {/* ── Row 1: Customer + Estimate side by side ── */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Customer */}
                        {!isLocked ? (
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer *</Label>
                                <div className="relative mt-1">
                                    <div className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors" onClick={()=>setIsCustomerOpen(!isCustomerOpen)}>
                                        <span className={`text-sm ${selectedCustomer?'text-slate-900 font-medium':'text-slate-400'}`}>{selectedCustomer||'Select Customer...'}</span>
                                        <ChevronDown size={16} className="text-slate-400"/>
                                    </div>
                                    {isCustomerOpen&&(
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-2 border-b bg-slate-50"><Input placeholder="Search customers..." autoFocus value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} className="h-8 text-sm"/></div>
                                            <div className="overflow-y-auto flex-1 p-1">
                                                {filteredCustomers.length===0?<p className="text-xs text-slate-400 text-center py-4">No customers found</p>:filteredCustomers.map(c=>(
                                                    <div key={c} className={cn("px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between",selectedCustomer===c?"bg-blue-50 text-blue-700 font-medium":"text-slate-700")}
                                                        onClick={()=>{setSelectedCustomer(c);setSelectedEstimateId('');setFormData(p=>({...p,jobAddress:''}));setEstimateSearch('');setIsCustomerOpen(false);}}>
                                                        <span>{c}</span>{selectedCustomer===c&&<Check size={14}/>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {isCustomerOpen&&<div className="fixed inset-0 z-40" onClick={()=>setIsCustomerOpen(false)}/>}
                            </div>
                        ) : selectedCustomer ? (
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</Label>
                                <div className="mt-1 px-3 py-2 border rounded-xl bg-slate-50 text-sm font-medium text-slate-700">{selectedCustomer}</div>
                            </div>
                        ) : <div />}

                        {/* Estimate */}
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimate # *</Label>
                            {isLocked ? (
                                <div className="mt-1 px-3 py-2 border rounded-xl bg-slate-50 text-sm font-medium text-slate-700">
                                    {defaultEstimate?.estimate || editingLog?.estimate || '—'}
                                </div>
                            ) : (
                                <div className="relative mt-1">
                                    <div className={cn("w-full flex items-center justify-between px-3 py-2 border rounded-xl transition-colors",selectedCustomer?"cursor-pointer bg-white hover:border-slate-400":"cursor-not-allowed bg-slate-50 opacity-60")}
                                        onClick={()=>selectedCustomer&&setIsEstimateOpen(!isEstimateOpen)}>
                                        <span className={`text-sm ${selectedEstimateId?'text-slate-900 font-medium':'text-slate-400'}`}>
                                            {selectedEstimateObj?.estimate||(selectedCustomer?'Select Estimate...':'Select customer first...')}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400"/>
                                    </div>
                                    {isEstimateOpen&&(
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-2 border-b bg-slate-50"><Input placeholder="Search estimates..." autoFocus value={estimateSearch} onChange={e=>setEstimateSearch(e.target.value)} className="h-8 text-sm"/></div>
                                            <div className="overflow-y-auto flex-1 p-1">
                                                {filteredEstimates.length===0?<p className="text-xs text-slate-400 text-center py-4">No estimates</p>:filteredEstimates.map(est=>(
                                                    <div key={est._id} className={cn("px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between",selectedEstimateId===est._id?"bg-blue-50 text-blue-700 font-medium":"text-slate-700")}
                                                        onClick={()=>{setSelectedEstimateId(est._id);if(est.jobAddress)setFormData(p=>({...p,jobAddress:est.jobAddress||''}));setIsEstimateOpen(false);}}>
                                                        <div className="flex flex-col"><span className="font-bold">{est.estimate||'No #'}</span><span className="text-xs opacity-70">{est.projectName}</span></div>
                                                        {selectedEstimateId===est._id&&<Check size={14}/>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {isEstimateOpen&&<div className="fixed inset-0 z-40" onClick={()=>setIsEstimateOpen(false)}/>}
                        </div>
                    </div>

                    {/* ── Row 2: Date + Job Address ── */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</Label>
                            <Input type="date" value={formData.date} onChange={e=>setFormData(p=>({...p,date:e.target.value}))} className="mt-1"/>
                        </div>
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Address</Label>
                            <Input value={formData.jobAddress} onChange={e=>setFormData(p=>({...p,jobAddress:e.target.value}))} className="mt-1" placeholder="Auto-filled from estimate"/>
                        </div>
                    </div>

                    {/* ── Row 3: Pothole Items ── */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pothole Items</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5"><Plus size={14}/>Add Item</Button>
                        </div>

                        {formData.potholeItems.length===0?(
                            <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed rounded-2xl bg-slate-50/50">No pothole items yet. Click &quot;Add Item&quot; to start.</div>
                        ):(
                            <div className="space-y-4">
                                {formData.potholeItems.map((item,idx)=>(
                                    <div key={idx} className="border rounded-2xl bg-white shadow-sm overflow-hidden">
                                        {/* Item Header */}
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b">
                                            <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-lg bg-[#0F4C75] text-white flex items-center justify-center text-[10px] font-black">{idx+1}</span>
                                                Pothole Item
                                            </span>
                                            <button onClick={()=>removeItem(idx)} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={14}/></button>
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {/* Item Row 1: Pothole# + Utility + Soil + Depths */}
                                            <div className="grid grid-cols-5 gap-3">
                                                <div>
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Pothole #</Label>
                                                    <Input value={item.potholeNo} onChange={e=>changeItem(idx,'potholeNo',e.target.value)} className="h-8 text-xs mt-1"/>
                                                </div>
                                                <div className="relative">
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Type of Utility</Label>
                                                    <div className="w-full h-8 text-xs border rounded-lg px-2 bg-white flex items-center justify-between cursor-pointer hover:border-slate-400 mt-1" onClick={()=>setUtilityOpen(p=>({...p,[idx]:!p[idx]}))}>
                                                        <span className={`truncate ${item.typeOfUtility?'text-slate-900':'text-slate-400'}`}>{item.typeOfUtility||'Select...'}</span>
                                                        <ChevronDown size={12} className="text-slate-400 shrink-0"/>
                                                    </div>
                                                    <MyDropDown isOpen={!!utilityOpen[idx]} onClose={()=>setUtilityOpen(p=>({...p,[idx]:false}))} options={utilityOptions.map(o=>({id:o,label:o,value:o}))}
                                                        selectedValues={item.typeOfUtility?item.typeOfUtility.split(',').map(s=>s.trim()).filter(Boolean):[]}
                                                        onSelect={val=>{const cur=item.typeOfUtility?item.typeOfUtility.split(',').map(s=>s.trim()).filter(Boolean):[];const ex=cur.indexOf(val);changeItem(idx,'typeOfUtility',(ex>=0?cur.filter(c=>c!==val):[...cur,val]).join(', '));}}
                                                        onAdd={async val=>{if(!utilityOptions.includes(val))setUtilityOptions(p=>[...p,val]);const cur=item.typeOfUtility?item.typeOfUtility.split(',').map(s=>s.trim()).filter(Boolean):[];changeItem(idx,'typeOfUtility',[...cur,val].join(', '));}}
                                                        width="w-full" placeholder="Search utility types..." multiSelect/>
                                                </div>
                                                <div className="relative">
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Soil Type</Label>
                                                    <div className="w-full h-8 text-xs border rounded-lg px-2 bg-white flex items-center justify-between cursor-pointer hover:border-slate-400 mt-1" onClick={()=>setSoilOpen(p=>({...p,[idx]:!p[idx]}))}>
                                                        <span className={`truncate ${item.soilType?'text-slate-900':'text-slate-400'}`}>{item.soilType||'Select...'}</span>
                                                        <ChevronDown size={12} className="text-slate-400 shrink-0"/>
                                                    </div>
                                                    <MyDropDown isOpen={!!soilOpen[idx]} onClose={()=>setSoilOpen(p=>({...p,[idx]:false}))} options={soilOptions.map(o=>({id:o,label:o,value:o}))}
                                                        selectedValues={item.soilType?item.soilType.split(',').map(s=>s.trim()).filter(Boolean):[]}
                                                        onSelect={val=>{const cur=item.soilType?item.soilType.split(',').map(s=>s.trim()).filter(Boolean):[];const ex=cur.indexOf(val);changeItem(idx,'soilType',(ex>=0?cur.filter(c=>c!==val):[...cur,val]).join(', '));}}
                                                        onAdd={async val=>{if(!soilOptions.includes(val))setSoilOptions(p=>[...p,val]);const cur=item.soilType?item.soilType.split(',').map(s=>s.trim()).filter(Boolean):[];changeItem(idx,'soilType',[...cur,val].join(', '));}}
                                                        width="w-full" placeholder="Search soil types..." multiSelect/>
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Top Depth</Label>
                                                    <Input value={item.topDepthOfUtility} onChange={e=>changeItem(idx,'topDepthOfUtility',e.target.value)} className="h-8 text-xs mt-1"/>
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Bottom Depth</Label>
                                                    <Input value={item.bottomDepthOfUtility} onChange={e=>changeItem(idx,'bottomDepthOfUtility',e.target.value)} className="h-8 text-xs mt-1"/>
                                                </div>
                                            </div>

                                            {/* Item Row 2: Photos (left) | GPS (right) */}
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Left: Photos */}
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <Label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Photos</Label>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {item.photos?.map((photo,pIdx)=>(
                                                            <div key={pIdx} className="relative group">
                                                                <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-colors">
                                                                    <Image fill sizes="112px" src={cld(photo,{w:112,q:'auto'})} alt={`Photo ${pIdx+1}`} className="object-cover w-full h-full"/>
                                                                </div>
                                                                <button onClick={()=>{const p=[...(item.photos||[])];p.splice(pIdx,1);changeItem(idx,'photos',p);}}
                                                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <X size={10}/>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {uploadingItems[idx] ? (
                                                            <div className="w-14 h-14 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 flex flex-col items-center justify-center text-blue-500">
                                                                <Loader2 size={14} className="animate-spin" />
                                                                <span className="text-[7px] mt-0.5 font-medium">Uploading</span>
                                                            </div>
                                                        ) : (
                                                            <label className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                                                                <Upload size={14}/><span className="text-[7px] mt-0.5">Add</span>
                                                                <input type="file" multiple accept="image/*" className="hidden" onChange={e=>uploadPhotos(idx,e.target.files)}/>
                                                            </label>
                                                        )}
                                                    </div>
                                                    <p className="text-[7px] text-slate-400 mt-1.5">📍 GPS auto-extracted from photos</p>
                                                </div>

                                                {/* Right: GPS / Drop Pin */}
                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><MapPin size={10} className="text-emerald-500"/>Location</Label>
                                                        <div className="flex items-center gap-2">
                                                            <button type="button" onClick={()=>dropPin(idx)} disabled={geoLoading===idx}
                                                                className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                                                                {geoLoading===idx?<Loader2 size={10} className="animate-spin"/>:<LocateFixed size={10}/>} Drop Pin
                                                            </button>
                                                            {item.latitude&&item.longitude&&<a href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" className="text-[9px] text-blue-600 hover:underline font-medium">Map ↗</a>}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <Label className="text-[8px] text-slate-400">Latitude</Label>
                                                            <Input value={item.latitude||''} onChange={e=>changeItem(idx,'latitude',e.target.value)} className="h-7 text-xs mt-0.5" placeholder="0.000000"/>
                                                        </div>
                                                        <div>
                                                            <Label className="text-[8px] text-slate-400">Longitude</Label>
                                                            <Input value={item.longitude||''} onChange={e=>changeItem(idx,'longitude',e.target.value)} className="h-7 text-xs mt-0.5" placeholder="0.000000"/>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C75] hover:bg-[#0a3a5c]">
                        {saving?'Saving...':(editingLog?'Update':'Create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
