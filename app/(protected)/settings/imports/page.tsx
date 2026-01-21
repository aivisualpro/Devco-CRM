'use client';

import { useState, useRef } from 'react';
import { Upload, Clock, Import, ClipboardList, FileSpreadsheet, FileText, Loader2, ChevronRight } from 'lucide-react';
import { Header } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import Papa from 'papaparse';

export default function ImportsPage() {
    const { success, error: toastError } = useToast();
    const [isImporting, setIsImporting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const timesheetInputRef = useRef<HTMLInputElement>(null);
    const jhaInputRef = useRef<HTMLInputElement>(null);
    const jhaSignatureInputRef = useRef<HTMLInputElement>(null);
    const djtInputRef = useRef<HTMLInputElement>(null);
    const djtSignatureInputRef = useRef<HTMLInputElement>(null);

    const parseCSV = (csvText: string) => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let insideQuotes = false;
        const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < normalized.length; i++) {
            const char = normalized[i];
            const nextChar = normalized[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' && !insideQuotes) {
                currentRow.push(currentField.trim());
                if (currentRow.some(c => c)) rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.some(c => c)) rows.push(currentRow);
        }
        return rows;
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                // Use PapaParse
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const processedData = data.map((row: any) => {
                    const obj: any = { ...row };

                    // Handle Array fields
                    if (obj.assignees && typeof obj.assignees === 'string') {
                        obj.assignees = obj.assignees.split(/[,;]/).map((v: string) => v.trim()).filter(Boolean);
                    }

                    // Handle Dates
                    ['fromDate', 'toDate'].forEach(h => {
                        const val = obj[h];
                         if (val && typeof val === 'string') {
                                let finalDate = val;
                                // Regex matches M/D/YYYY
                                const mdYMatch = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
                                if (mdYMatch) {
                                    const [_, m, d, y, h_time, min, s] = mdYMatch;
                                    const pad = (n: string) => n.padStart(2, '0');
                                    const hh = h_time ? pad(h_time) : '00';
                                    const mm = min ? pad(min) : '00';
                                    const ss = s ? pad(s) : '00';
                                    finalDate = `${y}-${pad(m)}-${pad(d)}T${hh}:${mm}:${ss}.000Z`;
                                } else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                                    finalDate = `${val}T00:00:00.000Z`;
                                }
                                obj[h] = finalDate;
                         }
                    });

                    // Handle ID
                    if (obj.recordId) {
                        obj._id = obj.recordId;
                        delete obj.recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importSchedules', payload: { schedules: processedData } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${processedData.length} schedules`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportTimesheets = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("File must contain at least a header and one data row.");

                const headers = parsedRows[0].map(h => h.replace(/^"|"$/g, '').trim());

                const data = parsedRows.slice(1).map(values => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i] !== undefined) {
                            let val = values[i].replace(/^"|"$/g, '').trim();
                            obj[h] = val;
                        }
                    });
                     
                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    // Ensure type is uppercase for consistency if present
                    if ((obj as any).type) {
                        (obj as any).type = (obj as any).type.toUpperCase();
                    }

                    // Logic: if type is DRIVE TIME & dumpWashout is blank then hours = distance/0.55/100
                    if ((obj as any).type === 'DRIVE TIME' && !(obj as any).dumpWashout) {
                        const distance = parseFloat((obj as any).distance);
                        if (!isNaN(distance)) {
                            (obj as any).hours = (distance / 0.55 / 100).toString();
                        }
                    }
                    
                    return obj;
                });

                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importTimesheets', payload: { timesheets: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    const msg = resData.matched !== undefined 
                        ? `Processed ${data.length}. Matched: ${resData.matched}, Updated: ${resData.modified}`
                        : `Successfully imported ${data.length} timesheets`;
                    
                    if (resData.matched === 0) toastError(`0 records matched. Check Schedule IDs.`);
                    else success(msg);
                } else {
                    toastError(resData.error || 'Timesheet import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (timesheetInputRef.current) timesheetInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportJHA = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("File must contain at least a header and one data row.");

                const headers = parsedRows[0].map(h => h.replace(/^"|"$/g, '').trim());

                const data = parsedRows.slice(1).map(values => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i] !== undefined) {
                            let val = values[i].replace(/^"|"$/g, '').trim();
                            obj[h] = val;
                        }
                    });

                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importJHA', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} JHA records`);
                } else {
                    toastError(resData.error || 'JHA import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (jhaInputRef.current) jhaInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportJHASignatures = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                
                const res = await fetch('/api/jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importJHASignatures', payload: { records: data } })
                });

                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} signature records`);
                } else {
                    toastError(resData.error || 'Signature import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (jhaSignatureInputRef.current) jhaSignatureInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportDJT = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("File must contain at least a header and one data row.");

                const headers = parsedRows[0].map(h => h.replace(/^"|"$/g, '').trim());

                const data = parsedRows.slice(1).map(values => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i] !== undefined) {
                            let val = values[i].replace(/^"|"$/g, '').trim();
                            obj[h] = val;
                        }
                    });

                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/djt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importDJT', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} DJT records`);
                } else {
                    toastError(resData.error || 'DJT import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (djtInputRef.current) djtInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportDJTSignatures = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("File must contain at least a header and one data row.");

                const headers = parsedRows[0].map(h => h.replace(/^"|"$/g, '').trim());

                const data = parsedRows.slice(1).map(values => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i] !== undefined) {
                            let val = values[i].replace(/^"|"$/g, '').trim();
                            obj[h] = val;
                        }
                    });

                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/djt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importDJTSignatures', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} DJT signatures`);
                } else {
                    toastError(resData.error || 'DJT signatures import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (djtSignatureInputRef.current) djtSignatureInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const ImportCard = ({ title, icon: Icon, onClick, description, color }: any) => (
        <div 
            onClick={onClick}
            className="group relative bg-white rounded-[32px] p-6 cursor-pointer transition-all duration-300 border border-slate-100 hover:border-[#0F4C75]/30 hover:-translate-y-1 shadow-sm hover:shadow-xl"
        >
            <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500`}>
                    <Icon size={28} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{title}</h3>
                    <p className="text-sm font-medium text-slate-400">{description}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#0F4C75] group-hover:text-white transition-all duration-300">
                    <ChevronRight size={20} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <Header showDashboardActions={true} />
            
            <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto px-6 py-10">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Data Imports</h1>
                    <p className="text-lg text-slate-500 font-medium">Bulk import your schedule data using CSV files</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv" />
                    <input type="file" ref={timesheetInputRef} onChange={handleImportTimesheets} className="hidden" accept=".csv" />
                    <input type="file" ref={jhaInputRef} onChange={handleImportJHA} className="hidden" accept=".csv" />
                    <input type="file" ref={jhaSignatureInputRef} onChange={handleImportJHASignatures} className="hidden" accept=".csv" />
                    <input type="file" ref={djtInputRef} onChange={handleImportDJT} className="hidden" accept=".csv" />
                    <input type="file" ref={djtSignatureInputRef} onChange={handleImportDJTSignatures} className="hidden" accept=".csv" />

                    <ImportCard 
                        title="Import Schedules"
                        icon={Upload}
                        color="bg-teal-500"
                        description="Upload your project schedules and timelines"
                        onClick={() => fileInputRef.current?.click()}
                    />
                    
                    <ImportCard 
                        title="Import Timesheets"
                        icon={Clock}
                        color="bg-purple-500"
                        description="Bulk upload employee time card entries"
                        onClick={() => timesheetInputRef.current?.click()}
                    />

                    <ImportCard 
                        title="Import JHA"
                        icon={Import}
                        color="bg-rose-500"
                        description="Import Job Hazard Analysis safety records"
                        onClick={() => jhaInputRef.current?.click()}
                    />

                    <ImportCard 
                        title="Import JHA Signatures"
                        icon={ClipboardList}
                        color="bg-rose-600"
                        description="Restore signatures for JHA safety forms"
                        onClick={() => jhaSignatureInputRef.current?.click()}
                    />

                    <ImportCard 
                        title="Import DJT"
                        icon={FileSpreadsheet}
                        color="bg-violet-500"
                        description="Upload Daily Job Ticket execution data"
                        onClick={() => djtInputRef.current?.click()}
                    />

                    <ImportCard 
                        title="Import DJT Signatures"
                        icon={FileText}
                        color="bg-violet-600"
                        description="Restore signatures for Daily Job Tickets"
                        onClick={() => djtSignatureInputRef.current?.click()}
                    />
                </div>

                {isImporting && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center">
                        <div className="bg-white rounded-[32px] p-10 flex flex-col items-center shadow-2xl">
                            <Loader2 size={60} className="text-[#0F4C75] animate-spin mb-6" />
                            <h2 className="text-2xl font-black text-slate-900">Processing Import...</h2>
                            <p className="text-slate-500 font-bold mt-2">Please do not close this window</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
