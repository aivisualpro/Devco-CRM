'use client';

import React, { useState } from 'react';
import { Clock, Truck, MapPin, ChevronDown } from 'lucide-react';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui';
import { formatDateOnly, formatTimeOnly } from '@/lib/timeCardUtils';

interface TimeCardsWidgetProps {
    tcWidgetTimeCards: any[];
    tcWidgetTotals: { drive: number; site: number };
    timeCardsView: 'all' | 'self';
    setTimeCardsView: (view: 'all' | 'self') => void;
    timeCardsWidgetScope: string;
    initialData: any;
}

export function TimeCardsWidget({
    tcWidgetTimeCards,
    tcWidgetTotals,
    timeCardsView,
    setTimeCardsView,
    timeCardsWidgetScope,
    initialData
}: TimeCardsWidgetProps) {
    const [isDriveTimeOpen, setIsDriveTimeOpen] = useState(false);
    const [isSiteTimeOpen, setIsSiteTimeOpen] = useState(false);

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 lg:p-4`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">Time Cards</h2>
                    </div>
                    {timeCardsWidgetScope === 'all' && (
                        <div className="flex bg-slate-200/50 lg:bg-slate-100 rounded-lg p-0.5">
                            <button 
                                onClick={() => setTimeCardsView('self')}
                                className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                    timeCardsView === 'self' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Self
                            </button>
                            <button 
                                onClick={() => setTimeCardsView('all')}
                                className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                    timeCardsView === 'all' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                All
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 lg:gap-4 ml-1 lg:ml-0">
                    <div className="flex flex-col lg:items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Drive Time</span>
                        <span className="text-sm font-black text-blue-600">{tcWidgetTotals.drive.toFixed(2)} hrs</span>
                    </div>
                    <div className="w-px h-8 bg-slate-100 hidden lg:block" />
                    <div className="flex flex-col lg:items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Site Time</span>
                        <span className="text-sm font-black text-emerald-600">{tcWidgetTotals.site.toFixed(2)} hrs</span>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Drive Time Section */}
                <div>
                    <div 
                        className={`flex items-center justify-between mb-2 px-1 ${timeCardsView === 'all' ? 'cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors' : ''}`}
                        onClick={() => timeCardsView === 'all' && setIsDriveTimeOpen(!isDriveTimeOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <Truck size={14} className="text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drive Time</span>
                        </div>
                        {timeCardsView === 'all' && (
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDriveTimeOpen ? 'rotate-180' : ''}`} />
                        )}
                    </div>
                    {(timeCardsView === 'self' || isDriveTimeOpen) && (
                        <div className="overflow-x-auto">
                        <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent" className="table-fixed w-full">
                            <TableHead>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    {timeCardsView === 'all' && <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-left align-middle" style={{width:'18%'}}>Employee</TableHeader>}
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '18%'}}>Date</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '18%'}}>Estimate</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Washout</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Shop</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Dist</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '8%' : '16%'}}>Hrs</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tcWidgetTimeCards.filter(ts => ts.type?.toLowerCase().includes('drive')).length > 0 ? 
                                    tcWidgetTimeCards.filter(ts => ts.type?.toLowerCase().includes('drive')).map((ts, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50">
                                        {timeCardsView === 'all' && (
                                            <TableCell className="text-left align-middle text-[11px] font-semibold text-slate-700 truncate max-w-[100px]">
                                                {(() => { const emp = initialData?.employees?.find((e: any) => e.value?.toLowerCase() === ts.employee?.toLowerCase()); return emp?.label || ts.employee?.split('@')[0] || '-'; })()}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                            {formatDateOnly(ts.clockIn)}
                                        </TableCell>
                                        <TableCell className="text-center align-middle">
                                            <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center align-middle">
                                            {ts.dumpWashout ? (
                                                <span className="text-[9px] font-black uppercase bg-orange-500 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 justify-center">
                                                    <span>Washout</span>
                                                </span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center align-middle">
                                            {ts.shopTime ? (
                                                <span className="text-[9px] font-black uppercase bg-blue-500 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 justify-center">
                                                    <span>Shop</span>
                                                </span>
                                            ) : <span className="text-slate-300">-</span>}
                                        </TableCell>
                                        <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                            {(ts.distanceVal || 0) > 0 ? (ts.distanceVal).toFixed(1) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center align-middle text-[11px] font-black text-slate-800">
                                            {(ts.hoursVal || 0).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={timeCardsView === 'all' ? 7 : 6} className="text-center py-4 text-xs text-slate-300 italic">No drive records</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </div>

                {/* Site Time Section */}
                <div>
                    <div 
                        className={`flex items-center justify-between mb-2 px-1 ${timeCardsView === 'all' ? 'cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors' : ''}`}
                        onClick={() => timeCardsView === 'all' && setIsSiteTimeOpen(!isSiteTimeOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Site Time</span>
                        </div>
                        {timeCardsView === 'all' && (
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSiteTimeOpen ? 'rotate-180' : ''}`} />
                        )}
                    </div>
                    {(timeCardsView === 'self' || isSiteTimeOpen) && (
                        <div className="overflow-x-auto">
                        <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent" className="table-fixed w-full">
                            <TableHead>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    {timeCardsView === 'all' && <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-left align-middle" style={{width:'18%'}}>Employee</TableHeader>}
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '20%'}}>Date</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '20%'}}>Estimate</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '18%' : '20%'}}>In</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '18%' : '20%'}}>Out</TableHeader>
                                    <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '8%' : '20%'}}>Hrs</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tcWidgetTimeCards.filter(ts => !ts.type?.toLowerCase().includes('drive')).length > 0 ? 
                                    tcWidgetTimeCards.filter(ts => !ts.type?.toLowerCase().includes('drive')).map((ts, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50">
                                        {timeCardsView === 'all' && (
                                            <TableCell className="text-left align-middle text-[11px] font-semibold text-slate-700 truncate max-w-[100px]">
                                                {(() => { const emp = initialData?.employees?.find((e: any) => e.value?.toLowerCase() === ts.employee?.toLowerCase()); return emp?.label || ts.employee?.split('@')[0] || '-'; })()}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                            {formatDateOnly(ts.clockIn)}
                                        </TableCell>
                                        <TableCell className="text-center align-middle">
                                            <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                            {formatTimeOnly(ts.clockIn)}
                                        </TableCell>
                                        <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                            {formatTimeOnly(ts.clockOut)}
                                        </TableCell>
                                        <TableCell className="text-center align-middle text-[11px] font-black text-slate-800">
                                            {(ts.hoursVal || 0).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={timeCardsView === 'all' ? 6 : 5} className="text-center py-4 text-xs text-slate-300 italic">No site records</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
