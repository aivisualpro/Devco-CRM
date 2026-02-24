'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Upload, Clock, Import, ClipboardList, FileSpreadsheet, FileText, Loader2, ChevronRight, RefreshCw, Image, Footprints, DollarSign, Layout, Receipt, Link as LinkIcon, MapPin, FileBarChart, Search, X, Drill, GraduationCap, FlaskConical } from 'lucide-react';
import { Header } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import Papa from 'papaparse';

export default function ImportsPage() {
    const { success, error: toastError } = useToast();
    const [isImporting, setIsImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const connected = searchParams.get('success');
        const err = searchParams.get('error');

        if (connected === 'quickbooks_connected') {
            success('QuickBooks account connected successfully!');
            router.replace('/settings/imports');
        }
        if (err) {
            toastError(`Authentication failed: ${err}`);
            router.replace('/settings/imports');
        }
    }, [searchParams, success, toastError, router]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const timesheetInputRef = useRef<HTMLInputElement>(null);
    const jhaInputRef = useRef<HTMLInputElement>(null);
    const jhaSignatureInputRef = useRef<HTMLInputElement>(null);
    const djtInputRef = useRef<HTMLInputElement>(null);
    const djtSignatureInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const footerInputRef = useRef<HTMLInputElement>(null);
    const coverFrameInputRef = useRef<HTMLInputElement>(null);
    const receiptsAndCostsInputRef = useRef<HTMLInputElement>(null);
    const planningDocsInputRef = useRef<HTMLInputElement>(null);
    const billingTicketsInputRef = useRef<HTMLInputElement>(null);
    const potholeLogsInputRef = useRef<HTMLInputElement>(null);
    const potholeItemsInputRef = useRef<HTMLInputElement>(null);
    const preBoreLogsInputRef = useRef<HTMLInputElement>(null);
    const preBoreLogItemsInputRef = useRef<HTMLInputElement>(null);
    const estimatesInputRef = useRef<HTMLInputElement>(null);
    const certificationsInputRef = useRef<HTMLInputElement>(null);
    const drugTestingInputRef = useRef<HTMLInputElement>(null);

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

    const handleImportEstimates = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importEstimates', payload: { estimates: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported/updated ${data.length} estimates`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (estimatesInputRef.current) estimatesInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
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

    const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload-logo', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                success('Template Header Logo updated successfully');
            } else {
                toastError(data.error || 'Failed to upload logo');
            }
        } catch (err: any) {
            console.error(err);
            toastError(err.message || 'Error uploading logo');
        } finally {
            setIsImporting(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleUploadFooter = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload-footer', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                success('Template Footer Image updated successfully');
            } else {
                toastError(data.error || 'Failed to upload footer');
            }
        } catch (err: any) {
            console.error(err);
            toastError(err.message || 'Error uploading footer');
        } finally {
            setIsImporting(false);
            if (footerInputRef.current) footerInputRef.current.value = '';
        }
    };

    const handleUploadCoverFrame = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload-cover-frame', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                success('Template Cover Frame updated successfully');
            } else {
                toastError(data.error || 'Failed to upload cover frame');
            }
        } catch (err: any) {
            console.error(err);
            toastError(err.message || 'Error uploading cover frame');
        } finally {
            setIsImporting(false);
            if (coverFrameInputRef.current) coverFrameInputRef.current.value = '';
        }
    };

    const handleImportReceiptsAndCosts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importReceiptsAndCosts', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} receipts & costs records`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (receiptsAndCostsInputRef.current) receiptsAndCostsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportPlanningDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importPlanningDocs', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} planning documents`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (planningDocsInputRef.current) planningDocsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportBillingTickets = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const processedData = data.map((row: any) => {
                    // Normalize keys to lowercase and trim
                    const normalizedRow: Record<string, any> = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.toLowerCase().trim().replace(/[\s_#]/g, ''); // remove spaces, _, #
                        normalizedRow[cleanKey] = row[key];
                    });

                    const cleanRow: any = { ...row };

                    // 1. Normalize Billing Terms
                    const termVal = normalizedRow['billingterms'] || 
                                    normalizedRow['terms'] || 
                                    normalizedRow['term'];
                    if (termVal) cleanRow.billingTerms = termVal;

                    // 2. Normalize Lump Sum
                    const sumVal = normalizedRow['lumpsum'] || 
                                   normalizedRow['amount'] || 
                                   normalizedRow['cost'] || 
                                   normalizedRow['price'];
                    if (sumVal) cleanRow.lumpSum = sumVal;

                    // 3. Normalize Estimate #
                    const estVal = normalizedRow['estimate'] || 
                                   normalizedRow['estimatenumber'] || 
                                   normalizedRow['proposal'] || 
                                   normalizedRow['proposalnumber'];
                    if (estVal) cleanRow.estimate = estVal;

                    // 4. Normalize Title Descriptions
                    // If 'description' field exists and no titleDescriptions, use it
                    const descVal = normalizedRow['description'] || normalizedRow['desc'];
                    const existingTD = normalizedRow['titledescriptions'];

                    if (!existingTD && descVal) {
                        cleanRow.titleDescriptions = JSON.stringify([{ title: '', description: descVal }]);
                    } else if (existingTD) {
                        cleanRow.titleDescriptions = existingTD;
                    }

                    return cleanRow;
                });

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importBillingTickets', payload: { records: processedData } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} billing tickets`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (billingTicketsInputRef.current) billingTicketsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportPotholeLogs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/pothole-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importPotholeLogs', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(resData.message || `Successfully imported pothole logs`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (potholeLogsInputRef.current) potholeLogsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportPotholeItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/pothole-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importPotholeItems', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(resData.message || `Successfully imported pothole items`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (potholeItemsInputRef.current) potholeItemsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportPreBoreLogs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/pre-bore-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importPreBoreLogs', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(resData.message || `Successfully imported pre-bore logs`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (preBoreLogsInputRef.current) preBoreLogsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportPreBoreLogItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/pre-bore-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importPreBoreLogItems', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(resData.message || `Successfully imported pre-bore log items`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (preBoreLogItemsInputRef.current) preBoreLogItemsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSyncQuickBooks = async () => {
        setIsImporting(true);
        try {
            const syncResponse = await fetch('/api/quickbooks/sync', { method: 'POST' });
            const syncData = await syncResponse.json();
            if (!syncData.success) {
                // If token error, offer re-authentication
                if (syncData.error?.includes('refresh token') || syncData.error?.includes('invalid_grant')) {
                    toastError('QuickBooks connection expired. Please click "Reconnect QuickBooks" below.');
                } else {
                    toastError(syncData.error || 'Sync failed');
                }
            } else {
                success(syncData.message || 'QuickBooks data synced successfully');
            }
        } catch (err: any) {
            console.error(err);
            toastError(err.message || 'Error syncing with QuickBooks');
        } finally {
            setIsImporting(false);
        }
    };

    const handleConnectQuickBooks = () => {
        // Redirect to our OAuth initiation route
        window.location.href = '/api/auth/quickbooks';
    };

    const handleImportCertifications = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importEmployeeCertifications', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${resData.count || data.length} certifications across ${resData.employeesUpdated || 0} employees`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (certificationsInputRef.current) certificationsInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportDrugTesting = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                if (!data || data.length === 0) throw new Error("No data found in CSV");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importDrugTestingRecords', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${resData.count || data.length} drug testing records across ${resData.employeesUpdated || 0} employees`);
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (drugTestingInputRef.current) drugTestingInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // All import items with categories for grouping and searching
    const importItems = [
        { title: 'Import Estimates', icon: FileBarChart, color: 'bg-sky-600', description: 'Bulk import estimate records from CSV', category: 'Core Data', onClick: () => estimatesInputRef.current?.click() },
        { title: 'Import Schedules', icon: Upload, color: 'bg-teal-500', description: 'Upload your project schedules and timelines', category: 'Core Data', onClick: () => fileInputRef.current?.click() },
        { title: 'Import Timesheets', icon: Clock, color: 'bg-purple-500', description: 'Bulk upload employee time card entries', category: 'Core Data', onClick: () => timesheetInputRef.current?.click() },
        { title: 'Import Planning Docs', icon: Layout, color: 'bg-violet-700', description: 'Bulk import USA tickets and job planning documents', category: 'Core Data', onClick: () => planningDocsInputRef.current?.click() },
        { title: 'Import Employee Certifications', icon: GraduationCap, color: 'bg-cyan-600', description: 'Bulk import training & certification records for employees', category: 'Core Data', onClick: () => certificationsInputRef.current?.click() },
        { title: 'Import Drug Testing Records', icon: FlaskConical, color: 'bg-rose-600', description: 'Bulk import drug testing records for employees', category: 'Core Data', onClick: () => drugTestingInputRef.current?.click() },
        { title: 'Import JHA', icon: Import, color: 'bg-rose-500', description: 'Import Job Hazard Analysis safety records', category: 'Documents & Signatures', onClick: () => jhaInputRef.current?.click() },
        { title: 'Import JHA Signatures', icon: ClipboardList, color: 'bg-rose-600', description: 'Restore signatures for JHA safety forms', category: 'Documents & Signatures', onClick: () => jhaSignatureInputRef.current?.click() },
        { title: 'Import DJT', icon: FileSpreadsheet, color: 'bg-violet-500', description: 'Upload Daily Job Ticket execution data', category: 'Documents & Signatures', onClick: () => djtInputRef.current?.click() },
        { title: 'Import DJT Signatures', icon: FileText, color: 'bg-violet-600', description: 'Restore signatures for Daily Job Tickets', category: 'Documents & Signatures', onClick: () => djtSignatureInputRef.current?.click() },
        { title: 'Import Receipts & Costs', icon: DollarSign, color: 'bg-emerald-600', description: 'Bulk import project receipts and vendor costs', category: 'Financial', onClick: () => receiptsAndCostsInputRef.current?.click() },
        { title: 'Import Billing Tickets', icon: Receipt, color: 'bg-indigo-600', description: 'Bulk import billing tickets for estimates', category: 'Financial', onClick: () => billingTicketsInputRef.current?.click() },
        { title: 'Import Pothole Logs', icon: MapPin, color: 'bg-amber-600', description: 'Bulk import pothole log data from CSV', category: 'Field Logs', onClick: () => potholeLogsInputRef.current?.click() },
        { title: 'Import Pothole Items', icon: MapPin, color: 'bg-orange-500', description: 'Add items to existing pothole logs', category: 'Field Logs', onClick: () => potholeItemsInputRef.current?.click() },
        { title: 'Import Pre-Bore Logs', icon: Drill, color: 'bg-violet-600', description: 'Bulk import pre-bore log data from CSV', category: 'Field Logs', onClick: () => preBoreLogsInputRef.current?.click() },
        { title: 'Import Pre-Bore Log Items', icon: Drill, color: 'bg-fuchsia-500', description: 'Add rod items to existing pre-bore logs', category: 'Field Logs', onClick: () => preBoreLogItemsInputRef.current?.click() },
        { title: 'Sync QuickBooks', icon: RefreshCw, color: 'bg-emerald-500', description: 'Fetch live project and financial data from QuickBooks', category: 'Integrations', onClick: handleSyncQuickBooks },
        { title: 'Reconnect QuickBooks', icon: LinkIcon, color: 'bg-slate-800', description: 'Refresh your connection if tokens have expired', category: 'Integrations', onClick: handleConnectQuickBooks },
        { title: 'Template Header Logo', icon: Image, color: 'bg-blue-600', description: 'Upload logo for PDF template headers', category: 'Template Assets', onClick: () => logoInputRef.current?.click() },
        { title: 'Template Footer Image', icon: Footprints, color: 'bg-indigo-500', description: 'Upload footer image for PDF templates', category: 'Template Assets', onClick: () => footerInputRef.current?.click() },
        { title: 'Template Cover Frame', icon: Image, color: 'bg-slate-700', description: 'Upload fixed cover frame for PDF templates', category: 'Template Assets', onClick: () => coverFrameInputRef.current?.click() },
    ];

    const categoryOrder = ['Core Data', 'Documents & Signatures', 'Financial', 'Field Logs', 'Integrations', 'Template Assets'];
    const categoryColors: Record<string, string> = {
        'Core Data': 'text-sky-600 bg-sky-50 border-sky-100',
        'Documents & Signatures': 'text-rose-600 bg-rose-50 border-rose-100',
        'Financial': 'text-emerald-600 bg-emerald-50 border-emerald-100',
        'Field Logs': 'text-amber-600 bg-amber-50 border-amber-100',
        'Integrations': 'text-green-600 bg-green-50 border-green-100',
        'Template Assets': 'text-slate-600 bg-slate-50 border-slate-100',
    };

    const query = searchQuery.toLowerCase().trim();
    const filteredItems = query
        ? importItems.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        )
        : importItems;

    // Group filtered items by category
    const groupedItems = categoryOrder.reduce((acc, cat) => {
        const items = filteredItems.filter(item => item.category === cat);
        if (items.length > 0) acc.push({ category: cat, items });
        return acc;
    }, [] as { category: string; items: typeof importItems }[]);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                searchInputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <Header showDashboardActions={true} />

            {/* Hidden file inputs */}
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv" />
            <input type="file" ref={estimatesInputRef} onChange={handleImportEstimates} className="hidden" accept=".csv" />
            <input type="file" ref={certificationsInputRef} onChange={handleImportCertifications} className="hidden" accept=".csv" />
            <input type="file" ref={drugTestingInputRef} onChange={handleImportDrugTesting} className="hidden" accept=".csv" />
            <input type="file" ref={timesheetInputRef} onChange={handleImportTimesheets} className="hidden" accept=".csv" />
            <input type="file" ref={jhaInputRef} onChange={handleImportJHA} className="hidden" accept=".csv" />
            <input type="file" ref={jhaSignatureInputRef} onChange={handleImportJHASignatures} className="hidden" accept=".csv" />
            <input type="file" ref={djtInputRef} onChange={handleImportDJT} className="hidden" accept=".csv" />
            <input type="file" ref={djtSignatureInputRef} onChange={handleImportDJTSignatures} className="hidden" accept=".csv" />
            <input type="file" ref={receiptsAndCostsInputRef} onChange={handleImportReceiptsAndCosts} className="hidden" accept=".csv" />
            <input type="file" ref={planningDocsInputRef} onChange={handleImportPlanningDocs} className="hidden" accept=".csv" />
            <input type="file" ref={billingTicketsInputRef} onChange={handleImportBillingTickets} className="hidden" accept=".csv" />
            <input type="file" ref={potholeLogsInputRef} onChange={handleImportPotholeLogs} className="hidden" accept=".csv" />
            <input type="file" ref={potholeItemsInputRef} onChange={handleImportPotholeItems} className="hidden" accept=".csv" />
            <input type="file" ref={preBoreLogsInputRef} onChange={handleImportPreBoreLogs} className="hidden" accept=".csv" />
            <input type="file" ref={preBoreLogItemsInputRef} onChange={handleImportPreBoreLogItems} className="hidden" accept=".csv" />
            <input type="file" ref={logoInputRef} onChange={handleUploadLogo} className="hidden" accept="image/png, image/jpeg" />
            <input type="file" ref={footerInputRef} onChange={handleUploadFooter} className="hidden" accept="image/png, image/jpeg" />
            <input type="file" ref={coverFrameInputRef} onChange={handleUploadCoverFrame} className="hidden" accept="image/png, image/jpeg" />
            
            <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Data Imports</h1>
                            <p className="text-sm text-slate-400 font-medium mt-1">
                                Bulk import your data using CSV files &middot; <span className="text-slate-500 font-bold">{filteredItems.length}</span> actions
                            </p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search imports... (e.g. estimates, timesheets, quickbooks)"
                            className="w-full pl-11 pr-24 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700
                                focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/15 focus:border-[#0F4C75]/40
                                transition-all duration-300 shadow-sm hover:shadow-md placeholder:text-slate-300"
                        />
                        {searchQuery ? (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-1">
                                <kbd className="px-1.5 h-5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded leading-5 min-w-[20px] text-center">⌘</kbd>
                                <span className="text-xs text-slate-300">+</span>
                                <kbd className="px-1.5 h-5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded leading-5 min-w-[20px] text-center">⇧</kbd>
                                <span className="text-xs text-slate-300">+</span>
                                <kbd className="px-1.5 h-5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded leading-5 min-w-[20px] text-center">F</kbd>
                            </div>
                        )}
                    </div>
                </div>

                {/* Categorized Cards */}
                {groupedItems.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Search className="w-7 h-7 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 mb-1">No results found</h3>
                        <p className="text-sm text-slate-400 font-medium">Try searching for a different term</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedItems.map(({ category, items }) => (
                            <section key={category}>
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">{category}</h2>
                                    <div className="flex-1 h-px bg-slate-100" />
                                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={item.title}
                                                onClick={item.onClick}
                                                className="group relative bg-white rounded-2xl p-5 cursor-pointer transition-all duration-300
                                                    border border-slate-100 hover:border-[#0F4C75]/20
                                                    hover:-translate-y-0.5 shadow-sm hover:shadow-lg
                                                    active:translate-y-0 active:shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center text-white shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg`}>
                                                        <Icon size={22} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-[15px] font-bold text-slate-800 mb-0.5 truncate">{item.title}</h3>
                                                        <p className="text-xs font-medium text-slate-400 truncate">{item.description}</p>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#0F4C75] group-hover:text-white transition-all duration-300 flex-shrink-0">
                                                        <ChevronRight size={16} />
                                                    </div>
                                                </div>
                                                {/* Subtle category tag on hover */}
                                                <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${categoryColors[item.category] || 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                                                    {item.category}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* Import Loading Overlay */}
            {isImporting && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[200] flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-10 flex flex-col items-center shadow-2xl max-w-sm mx-4">
                        <div className="w-20 h-20 rounded-2xl bg-[#0F4C75]/10 flex items-center justify-center mb-6">
                            <Loader2 size={40} className="text-[#0F4C75] animate-spin" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 mb-2">Processing Import</h2>
                        <p className="text-sm text-slate-500 font-medium text-center">This may take a moment. Please do not close this window.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

