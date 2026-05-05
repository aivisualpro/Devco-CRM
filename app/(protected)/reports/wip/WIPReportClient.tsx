
'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Header from '@/components/ui/Header';
import { BadgeTabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { 
    DollarSign, LayoutDashboard, Briefcase, RefreshCw, ExternalLink, 
    Calendar, User, Users, Search, Filter, Star, MoreVertical, 
    Settings, Printer, Share2, ChevronDown, Clock, Rocket, X,
    FileText, Target, TrendingUp, Zap, HelpCircle, PieChart as PieChartIcon, Info, ArrowLeft, FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Skeleton, SkeletonTableRow, SkeletonTable } from '@/components/ui';

import { DJTModal } from '../../jobs/schedules/components/DJTModal';
import { formatDateOnly } from '@/lib/timeCardUtils';
import { getLocalNowISO } from '@/lib/scheduleUtils';
// xlsx is imported dynamically in handleExportExcel to avoid loading the 272KB library in the initial bundle

interface Project {
    Id: string;
    DisplayName: string;
    CompanyName?: string;
    FullyQualifiedName: string;
    PrimaryEmailAddr?: { Address: string };
    PrimaryPhone?: { FreeFormNumber: string };
    MetaData: { CreateTime: string };
    Balance: number;
    CurrencyRef: { value: string };
    Active: boolean;
    // Enhanced fields for the UI
    income?: number; // Revenue Earned to Date
    cost?: number; // Cost of Revenue Earned
    qbCost?: number;
    devcoCost?: number;
    profitMargin?: number;
    timeSpent?: string;
    startDate?: string;
    endDate?: string;
    isFavorite?: boolean;
    proposalNumber?: string;
    proposalWriters?: string[];
    originalContract?: number;
    changeOrders?: number;
    estOriginalContract?: number;
    estChangeOrders?: number;
    isManualOriginalContract?: boolean;
    isManualChangeOrders?: boolean;
    status?: string;
    proposalSlug?: string;
    jobTickets?: any[];
}

export default function WIPReportClient({ 
    initialProjects = [], 
    initialEmployees = [], 
    initialEquipment = [] 
}: { 
    initialProjects?: any[], 
    initialEmployees?: any[], 
    initialEquipment?: any[] 
}) {
    const [activeTab, setActiveTab] = useState('wip');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState('Summary');
    const [projects, setProjects] = useState<Project[]>(() => {
        return initialProjects.map((p: any) => ({
            ...p,
            income: p.income || 0,
            cost: p.cost || 0,
            profitMargin: p.profitMargin || 0,
            timeSpent: '0:00',
            startDate: p.startDate ? formatDateOnly(p.startDate) : formatDateOnly(p.MetaData?.CreateTime),
            endDate: formatDateOnly(new Date(new Date(p.MetaData?.CreateTime || p.startDate || new Date()).getTime() + 86400000 * 30).toISOString()),
            isFavorite: Math.random() > 0.8
        })).sort((a: any, b: any) => {
            const aNum = a.proposalNumber || '';
            const bNum = b.proposalNumber || '';
            if (!aNum && !bNum) return 0;
            if (!aNum) return 1;
            if (!bNum) return -1;
            return bNum.localeCompare(aNum, undefined, { numeric: true });
        });
    });
    const [loading, setLoading] = useState(false);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [loadingProfitability, setLoadingProfitability] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
    const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
    const [editingProposalValue, setEditingProposalValue] = useState('');
    const [savingProposal, setSavingProposal] = useState(false);
    
    // Manual Edit State
    const [editingContractId, setEditingContractId] = useState<string | null>(null);
    const [editingChangeOrderId, setEditingChangeOrderId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');

    const [transactions, setTransactions] = useState<any[]>([]);
    const [txSearch, setTxSearch] = useState('');
    const [txTypeFilter, setTxTypeFilter] = useState<string[]>([]);
    const [txStatusFilter, setTxStatusFilter] = useState<string[]>([]);
    const [txTypeDropdownOpen, setTxTypeDropdownOpen] = useState(false);
    const [txStatusDropdownOpen, setTxStatusDropdownOpen] = useState(false);
    const [txCardFilter, setTxCardFilter] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [highlightedProject, setHighlightedProject] = useState<string | null>(null);

    const handleBackClick = () => {
        const projectId = selectedProject?.Id;
        setSelectedProject(null);
        if (projectId) {
            setHighlightedProject(projectId);
            setTimeout(() => {
                const row = document.getElementById(`project-row-${projectId}`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => setHighlightedProject(null), 2000);
                }
            }, 100);
        }
    };

    const handleSaveManualValue = async (projectId: string, field: 'originalContract' | 'changeOrders', value: string) => {
        try {
            // If empty, send null to revert to calculated
            const numericValue = value.trim() === '' ? null : value; 
            
            const response = await fetch(`/api/quickbooks/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: numericValue })
            });

            const data = await response.json();
            if (data.success) {
                // Update local state directly instead of re-fetching everything
                setProjects(prev => prev.map(p => {
                    if (p.Id === projectId) {
                        const isManual = numericValue !== null;
                        let newValue: number;
                        
                        if (isManual) {
                            newValue = parseFloat(value);
                        } else {
                            // Revert to baseline
                            newValue = field === 'originalContract' 
                                ? (p.estOriginalContract || 0) 
                                : (p.estChangeOrders || 0);
                        }

                        return {
                            ...p,
                            [field]: newValue,
                            [field === 'originalContract' ? 'isManualOriginalContract' : 'isManualChangeOrders']: isManual
                        };
                    }
                    return p;
                }));
                toast.success('Value updated');
            } else {
                toast.error(data.error || 'Failed to update value');
            }
        } catch (error) {
            console.error('Error updating value:', error);
            toast.error('Failed to update value');
        } finally {
            setEditingContractId(null);
            setEditingChangeOrderId(null);
            setEditingValue('');
        }
    };
    const [endDateFilter, setEndDateFilter] = useState('All');
    const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
    const ITEMS_PER_BATCH = 20;
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH);
    const sentinelRef = useRef<HTMLTableRowElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [employees, setEmployees] = useState<any[]>(initialEmployees);
    const [equipmentMachines, setEquipmentMachines] = useState<any[]>(initialEquipment);
    const [activeHighlight, setActiveHighlight] = useState<string[]>([]);
    
    // DJT Modal State
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const tabs = [
        { id: 'quickbooks', label: 'QuickBooks' },
        { id: 'wip', label: 'WIP' },
    ];

    const detailTabs = ['Summary', 'Transactions', 'Daily Job Tickets'];

    const fetchProjects = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        
        try {
            // If refreshing, trigger the actual sync first
            if (isRefresh) {
                const syncResponse = await fetch('/api/quickbooks/sync', { method: 'POST' });
                const syncData = await syncResponse.json();
                if (!syncData.success) {
                    toast.error(syncData.error || 'Sync failed');
                    // Continue to fetch at least what we have in DB
                } else {
                    toast.success(syncData.message);
                }
            }

            const response = await fetch('/api/quickbooks/projects');
            const data = await response.json();
            
            if (data.error) {
                toast.error(data.error);
            } else {
                // Use API values for income/cost/profitMargin if available, otherwise default to 0
                const enhanced = data.map((p: any) => ({
                    ...p,
                    income: p.income || 0,
                    cost: p.cost || 0,
                    profitMargin: p.profitMargin || 0,
                    timeSpent: '0:00',
                    startDate: formatDateOnly(p.MetaData.CreateTime),
                    endDate: formatDateOnly(new Date(new Date(p.MetaData.CreateTime).getTime() + 86400000 * 30).toISOString()),
                    isFavorite: Math.random() > 0.8
                })).sort((a: any, b: any) => {
                    // Sort by Proposal # descending (newest to oldest)
                    // Projects without a proposal number go to the bottom
                    const aNum = a.proposalNumber || '';
                    const bNum = b.proposalNumber || '';
                    if (!aNum && !bNum) return 0;
                    if (!aNum) return 1;
                    if (!bNum) return -1;
                    return bNum.localeCompare(aNum, undefined, { numeric: true });
                });
                
                setProjects(enhanced);
                if (isRefresh) toast.success('Projects refreshed successfully');
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
            toast.error('Failed to fetch projects');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchProjectProfitability = async (projectId: string) => {
        setLoadingProfitability(true);
        try {
            const response = await fetch(`/api/quickbooks/projects/${projectId}/profitability`);
            const data = await response.json();
            if (!data.error) {
                setSelectedProject(prev => prev ? {
                    ...prev,
                    income: data.income,
                    cost: data.totalCost,
                    qbCost: data.qbCost,
                    devcoCost: data.devcoCost,
                    profitMargin: data.profitMargin,
                    jobTickets: data.jobTickets
                } : null);
            }
        } catch (error) {
            console.error('Error fetching profitability:', error);
        } finally {
            setLoadingProfitability(false);
        }
    };

    const fetchProjectTransactions = async (projectId: string) => {
        setLoadingTransactions(true);
        try {
            const response = await fetch(`/api/quickbooks/projects/${projectId}/transactions`);
            const data = await response.json();
            if (data.error) {
                toast.error(data.error);
            } else {
                setTransactions(data);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            toast.error('Failed to fetch transactions');
        } finally {
            setLoadingTransactions(false);
        }
    };

    const syncIndividualProject = async (projectId: string) => {
        setSyncingProjectId(projectId);
        try {
            const response = await fetch('/api/quickbooks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`Project ${projectId} synced successfully`);
                // Update the project in the local list
                const projectResponse = await fetch('/api/quickbooks/projects');
                const projectData = await projectResponse.json();
                if (!projectData.error) {
                    const updatedProject = projectData.find((p: any) => p.Id === projectId);
                    if (updatedProject) {
                        setProjects(prev => prev.map(p => p.Id === projectId ? {
                            ...p,
                            ...updatedProject,
                            startDate: formatDateOnly(updatedProject.MetaData?.CreateTime || updatedProject.startDate),
                            endDate: formatDateOnly(new Date(new Date(updatedProject.MetaData?.CreateTime || updatedProject.startDate).getTime() + 86400000 * 30).toISOString()),
                            // Ensure these defaults are still applied if missing in updatedProject
                            income: updatedProject.income || 0,
                            cost: updatedProject.cost || 0,
                            profitMargin: updatedProject.profitMargin || 0
                        } : p));
                    }
                }
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (error) {
            console.error('Error syncing project:', error);
            toast.error('Sync failed');
        } finally {
            setSyncingProjectId(null);
        }
    };

    // Sync state from URL on initial load and when projects are fetched
    useEffect(() => {
        const projectIdFromUrl = searchParams.get('project');
        const tab = searchParams.get('tab');
        const mainTab = searchParams.get('view');

        if (mainTab && ['quickbooks', 'wip'].includes(mainTab)) {
            setActiveTab(mainTab);
        }

        if (projectIdFromUrl && projects.length > 0) {
            const project = projects.find(p => p.Id === projectIdFromUrl || p.proposalNumber === projectIdFromUrl);
            if (project) {
                // Only update if it's a DIFFERENT project
                if (!selectedProject || selectedProject.Id !== project.Id) {
                    setSelectedProject(project);
                }
                
                if (tab && detailTabs.includes(tab) && activeDetailTab !== tab) {
                    setActiveDetailTab(tab);
                }
            }
        } else if (!projectIdFromUrl && selectedProject) {
            // Only reset if we're NOT in transition (i.e. if the URL has no project but we have one)
            // Actually, if selectedProject was just set via UI, the URL will be updated soon.
            // We should only nullify if the URL explicitly has no project AND we had one.
            setSelectedProject(null);
        }
    }, [projects.length, searchParams]); // Removed selectedProject?.Id as dependency to avoid immediate reset loops

    // Update URL when state changes
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (activeTab !== 'wip') {
            params.set('view', activeTab);
        } else {
            params.delete('view');
        }

        if (selectedProject) {
            params.set('project', selectedProject.proposalNumber || selectedProject.Id);
            params.set('tab', activeDetailTab);
        } else {
            params.delete('project');
            params.delete('tab');
        }

        const newSearch = params.toString();
        const query = newSearch ? `?${newSearch}` : '';
        
        // Use replace to avoid cluttering history while navigating tabs
        router.replace(`${pathname}${query}`, { scroll: false });
    }, [selectedProject, activeDetailTab, activeTab, pathname, router]);

    const handleSaveProposal = async (projectId: string) => {
        setSavingProposal(true);
        try {
            const response = await fetch(`/api/quickbooks/projects/${projectId}/proposal`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposalNumber: editingProposalValue })
            });
            const data = await response.json();
            if (data.success) {
                // We need to re-fetch or use the returned contract info
                // The backend now returns contractAmount (which is the originalContract)
                setProjects(prev => prev.map(p => p.Id === projectId ? { 
                    ...p, 
                    proposalNumber: editingProposalValue,
                    originalContract: data.contractAmount || 0 
                } : p));
                toast.success('Proposal number updated');
                setEditingProposalId(null);
            } else {
                toast.error(data.error || 'Failed to update proposal number');
            }
        } catch (error) {
            console.error('Error updating proposal number:', error);
            toast.error('Failed to update proposal number');
        } finally {
            setSavingProposal(false);
        }
    };

    useEffect(() => {
        // Initial fetch is now handled server-side
        // fetchProjects();
        // fetchEmployees();
        // fetchEquipment();
    }, []);

    const handleSaveDJT = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDJT) return;
        try {
            const payload = { ...selectedDJT, schedule_id: selectedDJT.schedule_id || selectedDJT._id };
            const res = await fetch('/api/djt', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'saveDJT', payload }) 
            });
            const data = await res.json();
            if (data.success) {
                toast.success('DJT Saved');
                setDjtModalOpen(false);
                if (selectedProject) fetchProjectProfitability(selectedProject.Id);
            } else {
                toast.error(data.error || 'Failed to save DJT');
            }
        } catch (e) {
            console.error('Error saving DJT:', e);
            toast.error('Failed to save DJT');
        }
    };

    const handleSaveDJTSignature = async (data: any) => {
        if (!activeSignatureEmployee || !selectedDJT) return;
        setIsSavingSignature(true);
        try {
            const payload = { 
                schedule_id: selectedDJT.schedule_id, 
                employee: activeSignatureEmployee, 
                signature: typeof data === 'string' ? data : data.signature, 
                createdBy: 'WIP Report',
                clientNow: getLocalNowISO()
            };
            const res = await fetch('/api/djt', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'saveDJTSignature', payload }) 
            });
            const json = await res.json();
            if (json.success) {
                setSelectedDJT((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), json.result] }));
                setActiveSignatureEmployee(null);
                toast.success('Signature Saved');
                if (selectedProject) fetchProjectProfitability(selectedProject.Id);
            } else {
                toast.error(json.error || 'Failed to save signature');
            }
        } catch (e) {
            console.error('Error saving signature:', e);
            toast.error('Failed to save signature');
        } finally {
            setIsSavingSignature(false);
        }
    };

    const handleDownloadDjtPdf = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            
            // DJT Template Variables: {{customerId}}, {{projectName}}, {{date}}, {{day}}, {{estimate}}, {{jobAddress}}, {{dailyJobDescription}}, {{customerPrintName}}, {{customerSignature}}
            const variables: Record<string, any> = {
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',
                customerSignature: selectedDJT.customerSignature || '',
                customerId: selectedProject?.DisplayName || selectedProject?.CompanyName || '',
                projectName: selectedProject?.DisplayName || '',
                jobLocation: selectedDJT.jobLocation || '',
                jobAddress: selectedDJT.jobLocation || selectedDJT.jobAddress || '',
                estimate: selectedProject?.proposalNumber || '',
                date: new Date(selectedDJT.date || new Date()).toLocaleDateString(),
                day: new Date(selectedDJT.date || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) throw new Error('Failed to generate PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DJT_${selectedProject?.proposalNumber || 'Report'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('PDF Downloaded');
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to download PDF');
        } finally {
            setIsGeneratingDJTPDF(false);
        }
    };

    useEffect(() => {
        if (selectedProject) {
            fetchProjectTransactions(selectedProject.Id);
            fetchProjectProfitability(selectedProject.Id);
        } else {
            setTransactions([]);
        }
    }, [selectedProject?.Id]);

    // Load and Persist date range filter to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('qb_date_range_filter');
            if (saved) setDateRangeFilter(saved);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('qb_date_range_filter', dateRangeFilter);
        }
    }, [dateRangeFilter]);

    // Helper function to check if a date falls within the selected range
    const isWithinDateRange = (dateString: string) => {
        if (!dateString) return true;
        const date = new Date(dateString);
        const now = new Date();
        
        switch (dateRangeFilter) {
            case 'last_year': {
                const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
                const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                return date >= lastYearStart && date <= lastYearEnd;
            }
            case 'this_year': {
                const thisYearStart = new Date(now.getFullYear(), 0, 1);
                return date >= thisYearStart && date <= now;
            }
            case 'this_month': {
                const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                return date >= thisMonthStart && date <= now;
            }
            case 'all':
            default:
                return true;
        }
    };

    const filteredProjects = projects.filter(project => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = searchQuery === '' || 
            project.DisplayName.toLowerCase().includes(query) ||
            (project.CompanyName && project.CompanyName.toLowerCase().includes(query)) ||
            (project.proposalNumber && project.proposalNumber.toLowerCase().includes(query)) ||
            (project.proposalWriters && project.proposalWriters.some(w => w.toLowerCase().includes(query)));
        
        // Apply date range filter based on project creation date
        const matchesDateRange = isWithinDateRange(project.MetaData?.CreateTime);
        
        return matchesSearch && matchesDateRange;
    });

    const totalIncome = filteredProjects.reduce((acc, p) => acc + (p.income || 0), 0);
    const totalCost = filteredProjects.reduce((acc, p) => acc + (p.cost || 0), 0);
    const totalProfit = totalIncome - totalCost;

    const openInvoicesTotal = transactions
        .filter(tx => tx.type === 'Invoice' && (tx.status === 'Open' || tx.status === 'Overdue'))
        .reduce((sum, tx) => sum + tx.amount, 0);
    
    const overdueInvoicesTotal = transactions
        .filter(tx => tx.type === 'Invoice' && tx.status === 'Overdue')
        .reduce((sum, tx) => sum + tx.amount, 0);

    const hasActiveFilters = 
        searchQuery !== '' || 
        dateRangeFilter !== 'all';

    const clearFilters = () => {
        setSearchQuery('');
        setDateRangeFilter('all');
        setVisibleCount(ITEMS_PER_BATCH);
    };

    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        try {
            const XLSX = await import('xlsx');
            const fmt = (val: number) => Math.round(val * 100) / 100;

            const rows = filteredProjects.map((project) => {
                const originalContract = project.originalContract || 0;
                const changeOrders = project.changeOrders || 0;
                const updatedContract = originalContract + changeOrders;

                const originalContractCost = (project as any).originalContractCost || 0;
                const changeOrderCost = 0;
                const totalEstimatedCost = originalContractCost + changeOrderCost;

                const originalContractGP = originalContract - originalContractCost;
                const changeOrderGP = 0;
                const estimatedGP = updatedContract - totalEstimatedCost;

                const revenueToDate = project.income || 0;
                const costOfRevenue = project.cost || 0;
                const grossProfit = revenueToDate - costOfRevenue;
                const grossProfitPct = revenueToDate > 0 ? (grossProfit / revenueToDate) * 100 : 0;
                const grossMarkupPct = costOfRevenue > 0 ? (grossProfit / costOfRevenue) * 100 : 0;
                const percentageComplete = updatedContract > 0 ? (revenueToDate / updatedContract) * 100 : 0;

                return {
                    'Project': project.DisplayName || '',
                    'Proposal #': project.proposalNumber || '',
                    'Date': formatDateOnly(project.startDate) || '',
                    'Proposal Writers': (project.proposalWriters || []).join(', '),
                    'Client': project.CompanyName || '',
                    'Original Contract': fmt(originalContract),
                    'Change Orders': fmt(changeOrders),
                    'Updated Contract': fmt(updatedContract),
                    'Original Contract Cost': fmt(originalContractCost),
                    'Change Order Cost': fmt(changeOrderCost),
                    'Total Estimated Cost': fmt(totalEstimatedCost),
                    'Original Contract GP': fmt(originalContractGP),
                    'Change Order GP': fmt(changeOrderGP),
                    'Estimated GP': fmt(estimatedGP),
                    'Revenue Earned to Date': fmt(revenueToDate),
                    'Cost of Revenue Earned': fmt(costOfRevenue),
                    'Gross Profit (Loss)': fmt(grossProfit),
                    'Gross Profit (%)': fmt(grossProfitPct),
                    'Gross Markup on Cost (%)': fmt(grossMarkupPct),
                    '% Complete': fmt(percentageComplete),
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);

            // Auto-size columns based on content
            const colWidths = Object.keys(rows[0] || {}).map((key) => {
                const maxLen = Math.max(
                    key.length,
                    ...rows.map(r => String((r as any)[key] ?? '').length)
                );
                return { wch: Math.min(maxLen + 2, 30) };
            });
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'WIP Report');

            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `WIP_Report_${dateStr}.xlsx`);
            toast.success('WIP Report exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export WIP report');
        } finally {
            setIsExporting(false);
        }
    }, [filteredProjects]);

    // Pagination logic
    const visibleProjects = filteredProjects.slice(0, visibleCount);
    const hasMore = visibleCount < filteredProjects.length;

    useEffect(() => {
        setVisibleCount(ITEMS_PER_BATCH);
    }, [searchQuery, dateRangeFilter]);

    // Infinite scroll: IntersectionObserver on sentinel row
    useEffect(() => {
        const sentinel = sentinelRef.current;
        const container = scrollContainerRef.current;
        if (!sentinel || !container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setVisibleCount(prev => prev + ITEMS_PER_BATCH);
                }
            },
            { root: container, rootMargin: '200px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, visibleCount, selectedProject?.Id, activeTab]);

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <TooltipProvider>
            <Header 
                showDashboardActions={true} 
                wipReportFilters={!selectedProject ? {
                    activeTab,
                    setActiveTab,
                    searchQuery,
                    setSearchQuery,
                    dateRangeFilter,
                    setDateRangeFilter,
                    hasActiveFilters,
                    clearFilters,
                    onExportExcel: handleExportExcel,
                    isExporting,
                    onRefresh: () => fetchProjects(true),
                    isRefreshing: refreshing
                } : undefined}
            />
            
            <main className={`flex-1 flex flex-col min-h-0 ${!selectedProject ? 'p-4' : ''} bg-[#f8fafc]`}>
                <div className={`flex-1 flex flex-col min-h-0 ${!selectedProject ? 'space-y-6' : ''}`}>
                    {/* Project Detail Header removed per user request */}

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {activeTab === 'quickbooks' && (
                            <div className="space-y-6 animate-fade-in">

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Card className="p-5 space-y-1.5 border-l-4 border-l-emerald-500 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Project Income</span>
                                            <DollarSign className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div className="text-xl font-black text-slate-900">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(filteredProjects.reduce((acc, p) => acc + (p.income || 0), 0))}
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                            <ChevronDown className="w-3 h-3 rotate-180" /> +12.5%
                                        </div>
                                    </Card>

                                    <Card className="p-5 space-y-1.5 border-l-4 border-l-amber-500 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Project Costs</span>
                                            <Briefcase className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="text-xl font-black text-slate-900">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(filteredProjects.reduce((acc, p) => acc + (p.cost || 0), 0))}
                                        </div>
                                        <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                            <ChevronDown className="w-3 h-3 rotate-180" /> +4.2%
                                        </div>
                                    </Card>

                                    <Card className="p-5 space-y-1.5 border-l-4 border-l-[#0F4C75] shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Profit</span>
                                            <LayoutDashboard className="w-4 h-4 text-[#0F4C75]" />
                                        </div>
                                        <div className="text-xl font-black text-slate-900">
                                            {filteredProjects.length > 0 ? Math.floor(filteredProjects.reduce((acc, p) => acc + (p.profitMargin || 0), 0) / filteredProjects.length) : 0}%
                                        </div>
                                        <div className="text-[10px] font-bold text-[#0F4C75] flex items-center gap-1">
                                            Healthy Margin
                                        </div>
                                    </Card>

                                    <Card className="p-5 space-y-1.5 border-l-4 border-l-purple-500 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Projects</span>
                                            <RefreshCw className="w-4 h-4 text-purple-500" />
                                        </div>
                                        <div className="text-xl font-black text-slate-900">
                                            {filteredProjects.length}
                                        </div>
                                        <div className="text-[10px] font-bold text-purple-600 flex items-center gap-1">
                                            Syncing
                                        </div>
                                    </Card>

                                    <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 bg-white/50 col-span-full">
                                        <div className="p-4 bg-slate-100 rounded-full">
                                            <LayoutDashboard className="w-12 h-12 text-slate-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">Charts & Analytics</h3>
                                            <p className="text-slate-500 max-w-md mx-auto mt-2">
                                                Visual charts for income vs cost trends and project performance over time are coming soon in the next update.
                                            </p>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {activeTab === 'wip' && (
                            <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fade-in">
                                {selectedProject ? (
                                    /* Project Detail View (Page Mode) */
                                    <div className="bg-white rounded-none shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
                                        {/* Header Navigation */}
                                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 xl:gap-4 px-3 xl:px-6 py-3 xl:py-4 bg-white border-b border-slate-100 shrink-0">
                                            {/* Mobile Top Row: Back, Search & Sync */}
                                            <div className="flex items-center justify-between gap-2 shrink-0 w-full xl:w-auto">
                                                <button 
                                                    onClick={handleBackClick}
                                                    className="flex items-center justify-center gap-2 px-3 xl:px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-all border border-slate-200 shadow-sm shrink-0 h-10 xl:h-14 group"
                                                >
                                                    <ArrowLeft className="w-4 xl:w-5 h-4 xl:h-5 transition-transform group-hover:-translate-x-1" />
                                                    <span className="text-[11px] xl:text-sm font-bold pr-1">Back</span>
                                                </button>
                                                
                                                {/* Mobile Search Input */}
                                                <div className="relative flex-1 block xl:hidden">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search transactions..."
                                                        value={txSearch}
                                                        onChange={(e) => setTxSearch(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] shadow-sm hover:bg-white transition-all h-10"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => fetchProjectTransactions(selectedProject.Id)}
                                                    disabled={loadingTransactions}
                                                    className="flex xl:hidden items-center justify-center gap-2 px-3 py-2 bg-[#0F4C75] hover:bg-[#3282B8] text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed h-10 shrink-0"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
                                                    <span className="text-[11px]">Sync</span>
                                                </button>
                                            </div>

                                            <div className="h-10 w-px bg-slate-200 shrink-0 mx-2 hidden xl:block"></div>

                                            {/* Info Boxes */}
                                            <div className="flex-1 flex flex-col xl:flex-row items-start xl:items-stretch gap-1 xl:gap-3 min-w-0 pb-1 xl:pb-0">
                                                {/* Client Name (40%) */}
                                                <div className="w-full xl:w-[40%] shrink-0 flex flex-row xl:flex-col items-center xl:items-start gap-1.5 xl:gap-0 xl:bg-slate-50 xl:border xl:border-slate-100 xl:rounded-xl xl:p-3 justify-start xl:justify-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest xl:mb-1 w-20 xl:w-auto shrink-0">
                                                        <span className="xl:hidden">Client:</span>
                                                        <span className="hidden xl:inline">Client Name</span>
                                                    </span>
                                                    <span className="text-[11px] xl:text-sm font-black text-slate-800 flex items-center gap-1.5 xl:gap-2 truncate">
                                                        <Briefcase size={14} className="text-[#0F4C75] shrink-0 hidden xl:block" />
                                                        <span className="truncate">{selectedProject.CompanyName || selectedProject.DisplayName.split(':')?.[0] || '---'}</span>
                                                    </span>
                                                </div>

                                                {/* Proposal Name (40%) */}
                                                <div className="w-full xl:w-[40%] shrink-0 flex flex-row xl:flex-col items-center xl:items-start gap-1.5 xl:gap-0 xl:bg-slate-50 xl:border xl:border-slate-100 xl:rounded-xl xl:p-3 justify-start xl:justify-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest xl:mb-1 w-20 xl:w-auto shrink-0">Proposal<span className="xl:hidden">:</span></span>
                                                    <span className="text-[11px] xl:text-sm font-black text-slate-800 flex items-center gap-1.5 xl:gap-2 truncate">
                                                        <FolderOpen size={14} className="text-purple-600 shrink-0 hidden xl:block" />
                                                        <span className="truncate">{selectedProject.DisplayName || '---'}</span>
                                                    </span>
                                                </div>

                                                {/* Proposal Writer (20%) */}
                                                <div className="w-full xl:w-[20%] shrink-0 flex flex-row xl:flex-col items-center xl:items-start gap-1.5 xl:gap-0 xl:bg-slate-50 xl:border xl:border-slate-100 xl:rounded-xl xl:p-3 justify-start xl:justify-center">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest xl:mb-1 w-20 xl:w-auto shrink-0">Writer<span className="xl:hidden">:</span></span>
                                                    <div className="flex items-center gap-2 truncate">
                                                        {(selectedProject.proposalWriters || []).length > 0 ? (
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {(selectedProject.proposalWriters || []).map((w: string, idx: number) => {
                                                                    const emp = employees.find(e => 
                                                                        `${e.firstName} ${e.lastName}`.toLowerCase() === w.toLowerCase() ||
                                                                        e.email?.toLowerCase() === w.toLowerCase() ||
                                                                        e._id?.toLowerCase() === w.toLowerCase()
                                                                    );
                                                                    const displayName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : w;
                                                                    const profilePic = emp?.profilePicture;
                                                                    return (
                                                                        <div key={idx} className="flex items-center gap-1.5 shrink-0 min-w-0">
                                                                            <div className="w-4 h-4 xl:w-5 xl:h-5 rounded-full bg-[#0F4C75] border border-white flex items-center justify-center text-[8px] text-white font-black shadow-sm overflow-hidden shrink-0 hidden xl:flex">
                                                                                {profilePic ? (
                                                                                    <img src={profilePic} alt={displayName} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    displayName.substring(0, 1).toUpperCase()
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[11px] xl:text-sm font-black text-slate-700 truncate">{displayName}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] xl:text-sm font-black text-slate-400 truncate">---</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-10 w-px bg-slate-200 shrink-0 mx-2 hidden xl:block"></div>

                                            {/* Search and Sync Actions Desktop */}
                                            <div className="hidden xl:flex items-center gap-3 shrink-0">
                                                {/* Desktop Search Input */}
                                                <div className="relative w-[220px]">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search transactions..."
                                                        value={txSearch}
                                                        onChange={(e) => setTxSearch(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] shadow-sm hover:bg-white transition-all h-14"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => fetchProjectTransactions(selectedProject.Id)}
                                                    disabled={loadingTransactions}
                                                    className="flex items-center justify-center gap-2 px-5 py-2 bg-[#0F4C75] hover:bg-[#3282B8] text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed h-14 shrink-0"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${loadingTransactions ? 'animate-spin' : ''}`} />
                                                    <span className="text-sm">Sync</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-0 p-4 bg-slate-50/50">
                                            {/* Financial Cards — single row of 7 */}
                                            {(() => {
                                                const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
                                                const costTypes = ['Expense', 'Check', 'Payroll Check', 'Bill'];
                                                const income = transactions.filter((tx: any) => tx.type === 'Invoice').reduce((s: number, tx: any) => s + (tx.amount || 0), 0);
                                                const qbCost = transactions.filter((tx: any) => costTypes.includes(tx.type)).reduce((s: number, tx: any) => s + (tx.amount || 0), 0);
                                                const tickets = selectedProject.jobTickets || [];
                                                const jobTicketCost = tickets.reduce((s: number, t: any) => s + (t.totalCost || 0), 0);
                                                const profit = income - qbCost - jobTicketCost;
                                                const profitPct = income > 0 ? ((profit / income) * 100).toFixed(0) : '0';
                                                const payment = transactions.filter((tx: any) => tx.type === 'Payment').reduce((s: number, tx: any) => s + (tx.amount || 0), 0);
                                                const ar = income - payment;
                                                const payables = transactions.filter((tx: any) => costTypes.includes(tx.type) && (tx.status === 'Open' || tx.status === 'Overdue')).reduce((s: number, tx: any) => s + (tx.amount || 0), 0);

                                                const handleCardClick = (card: string) => {
                                                    if (txCardFilter === card) {
                                                        setTxCardFilter(null);
                                                        setTxTypeFilter([]);
                                                        setTxStatusFilter([]);
                                                        return;
                                                    }
                                                    setTxCardFilter(card);
                                                    setTxSearch('');
                                                    switch (card) {
                                                        case 'income': setTxTypeFilter(['Invoice']); setTxStatusFilter([]); break;
                                                        case 'qbCost': setTxTypeFilter(costTypes); setTxStatusFilter([]); break;
                                                        case 'profit': setTxTypeFilter([]); setTxStatusFilter([]); break;
                                                        case 'payment': setTxTypeFilter(['Payment']); setTxStatusFilter([]); break;
                                                        case 'ar': setTxTypeFilter(['Invoice']); setTxStatusFilter([]); break;
                                                        case 'payables': setTxTypeFilter(costTypes); setTxStatusFilter(['Open', 'Overdue']); break;
                                                        default: setTxTypeFilter([]); setTxStatusFilter([]);
                                                    }
                                                };

                                                const ring = (card: string) => txCardFilter === card ? 'ring-2 ring-slate-800 ring-offset-2 scale-[1.02] shadow-md z-10' : 'hover:scale-[1.01] hover:shadow-sm opacity-95 hover:opacity-100 transition-opacity';

                                                return (
                                                    <div className="shrink-0 mb-3">
                                                        <div className="grid grid-cols-6 xl:flex gap-2 items-stretch">
                                                            {/* Income */}
                                                            <div onClick={() => handleCardClick('income')} className={`col-span-3 order-1 xl:order-1 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('income')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-emerald-50 border border-emerald-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-1">Income</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-emerald-950 tracking-tight leading-none">{fmt(income)}</p>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {/* QB Cost */}
                                                            <div onClick={() => handleCardClick('qbCost')} className={`col-span-2 order-3 xl:order-2 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('qbCost')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-blue-50 border border-blue-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-1">QB Cost</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-blue-950 tracking-tight leading-none">{fmt(qbCost)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className="bg-blue-100 rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2">
                                                                            <span className="text-[10px] xl:text-sm font-bold text-blue-700">{income > 0 ? ((qbCost / income) * 100).toFixed(0) : 0}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Job Ticket */}
                                                            <div className={`col-span-2 order-4 xl:order-3 flex-1 relative rounded-xl shadow-sm opacity-90`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-amber-50 border border-amber-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-amber-600 uppercase tracking-wider mb-1">Job Ticket</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-amber-950 tracking-tight leading-none">{fmt(jobTicketCost)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className="bg-amber-100 rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2">
                                                                            <span className="text-[10px] xl:text-sm font-bold text-amber-700">{income > 0 ? ((jobTicketCost / income) * 100).toFixed(0) : 0}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Profit */}
                                                            <div onClick={() => handleCardClick('profit')} className={`col-span-3 order-2 xl:order-4 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('profit')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Profit</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className={`text-xl font-black tracking-tight leading-none ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(profit)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className={`rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2 ${profit >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                                                            <span className={`text-[10px] xl:text-sm font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{profitPct}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Separator */}
                                                            <div className="hidden xl:block xl:order-5 w-px bg-slate-200 self-stretch mx-0.5 shrink-0" />

                                                            {/* Payment */}
                                                            <div onClick={() => handleCardClick('payment')} className={`col-span-2 order-5 xl:order-6 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('payment')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-teal-50 border border-teal-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-teal-600 uppercase tracking-wider mb-1">Payment</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-teal-950 tracking-tight leading-none">{fmt(payment)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className="bg-teal-100 rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2">
                                                                            <span className="text-[10px] xl:text-sm font-bold text-teal-700">{income > 0 ? ((payment / income) * 100).toFixed(0) : 0}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* A/R */}
                                                            <div onClick={() => handleCardClick('ar')} className={`col-span-3 order-6 xl:order-7 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('ar')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-rose-50 border border-rose-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-rose-600 uppercase tracking-wider mb-1">A/R</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-rose-950 tracking-tight leading-none">{fmt(ar)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className="bg-rose-100 rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2">
                                                                            <span className="text-[10px] xl:text-sm font-bold text-rose-700">{income > 0 ? ((ar / income) * 100).toFixed(0) : 0}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Payables */}
                                                            <div onClick={() => handleCardClick('payables')} className={`col-span-3 order-7 xl:order-8 flex-1 relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${ring('payables')}`}>
                                                                <div className="absolute inset-0 overflow-hidden rounded-xl bg-orange-50 border border-orange-200" />
                                                                <div className="relative p-3 pointer-events-none flex justify-between items-center h-full">
                                                                    <div className="flex flex-col justify-center">
                                                                        <p className="text-xs font-black text-orange-600 uppercase tracking-wider mb-1">Payables</p>
                                                                        {loadingTransactions ? <Skeleton className="h-6 w-24 rounded-md" /> : <p className="text-xl font-black text-orange-950 tracking-tight leading-none">{fmt(payables)}</p>}
                                                                    </div>
                                                                    {loadingTransactions ? <Skeleton className="h-5 w-8 xl:h-7 xl:w-12 rounded-md ml-1.5 xl:ml-2 shrink-0" /> : (
                                                                        <div className="bg-orange-100 rounded-md px-1.5 py-0.5 xl:px-2 xl:py-1 flex items-center justify-center shrink-0 ml-1.5 xl:ml-2">
                                                                            <span className="text-[10px] xl:text-sm font-bold text-orange-700">{income > 0 ? ((payables / income) * 100).toFixed(0) : 0}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* 2 Boxes: Transactions & Daily Job Tickets */}
                                            <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-3 flex-1 min-h-0 overflow-hidden">
                                                {/* Transactions Box */}
                                                <Card className="flex flex-col h-full border border-slate-200 shadow-none overflow-hidden bg-white">
                                                    <div className="px-3 py-2 border-b border-slate-100 bg-white shrink-0 space-y-1.5">
                                                        {/* Row 1: Title + Search + Filters + Counter */}
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 shrink-0">
                                                                <Briefcase size={16} className="text-[#0F4C75]" /> Transactions
                                                            </h3>

                                                            {/* Type multi-select filter */}
                                                            {(() => {
                                                                const types = [...new Set(transactions.map((tx: any) => tx.type).filter(Boolean))] as string[];
                                                                return (
                                                                    <div className="relative shrink-0 hidden xl:block">
                                                                        <button onClick={() => { setTxTypeDropdownOpen(!txTypeDropdownOpen); setTxStatusDropdownOpen(false); }} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-all ${
                                                                            txTypeFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                                                        }`}>
                                                                            Type {txTypeFilter.length > 0 && <span className="bg-blue-200 text-blue-800 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{txTypeFilter.length}</span>}
                                                                        </button>
                                                                        {txTypeDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-20" onClick={() => setTxTypeDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 min-w-[160px] py-1">
                                                                                    {txTypeFilter.length > 0 && (
                                                                                        <button onClick={() => setTxTypeFilter([])} className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-rose-500 hover:bg-rose-50 border-b border-slate-100">Clear All</button>
                                                                                    )}
                                                                                    {types.sort().map(t => (
                                                                                        <label key={t} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                                                                                            <input type="checkbox" checked={txTypeFilter.includes(t)} onChange={() => setTxTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 cursor-pointer" />
                                                                                            <span className="text-[11px] font-medium text-slate-700">{t}</span>
                                                                                        </label>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {/* Status multi-select filter */}
                                                            {(() => {
                                                                const statuses = [...new Set(transactions.map((tx: any) => tx.status).filter(Boolean))] as string[];
                                                                return (
                                                                    <div className="relative shrink-0 hidden xl:block">
                                                                        <button onClick={() => { setTxStatusDropdownOpen(!txStatusDropdownOpen); setTxTypeDropdownOpen(false); }} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-all ${
                                                                            txStatusFilter.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                                                        }`}>
                                                                            Status {txStatusFilter.length > 0 && <span className="bg-emerald-200 text-emerald-800 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{txStatusFilter.length}</span>}
                                                                        </button>
                                                                        {txStatusDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-20" onClick={() => setTxStatusDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 min-w-[130px] py-1">
                                                                                    {txStatusFilter.length > 0 && (
                                                                                        <button onClick={() => setTxStatusFilter([])} className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-rose-500 hover:bg-rose-50 border-b border-slate-100">Clear All</button>
                                                                                    )}
                                                                                    {statuses.sort().map(s => (
                                                                                        <label key={s} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                                                                                            <input type="checkbox" checked={txStatusFilter.includes(s)} onChange={() => setTxStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 cursor-pointer" />
                                                                                            <span className="text-[11px] font-medium text-slate-700">{s}</span>
                                                                                        </label>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <div className="flex-1" />
                                                            {/* Records counter + total */}
                                                            {(() => {
                                                                const q = txSearch.toLowerCase().trim();
                                                                let filtered = transactions as any[];
                                                                if (txTypeFilter.length > 0) filtered = filtered.filter((tx: any) => txTypeFilter.includes(tx.type));
                                                                if (txStatusFilter.length > 0) filtered = filtered.filter((tx: any) => txStatusFilter.includes(tx.status));
                                                                if (q) filtered = filtered.filter((tx: any) => 
                                                                    (tx.date && formatDateOnly(tx.date)?.toLowerCase().includes(q)) ||
                                                                    (tx.type && tx.type.toLowerCase().includes(q)) ||
                                                                    (tx.no && String(tx.no).toLowerCase().includes(q)) ||
                                                                    (tx.from && tx.from.toLowerCase().includes(q)) ||
                                                                    (tx.memo && tx.memo.toLowerCase().includes(q)) ||
                                                                    (tx.status && tx.status.toLowerCase().includes(q)) ||
                                                                    (tx.amount && String(tx.amount).includes(q))
                                                                );
                                                                const total = filtered.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
                                                                const hasFilter = txSearch || txTypeFilter.length > 0 || txStatusFilter.length > 0;
                                                                return (
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                                            {filtered.length}{hasFilter ? `/${transactions.length}` : ''} Records
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 overflow-auto bg-slate-50/30">
                                                        <table className="w-full min-w-[1000px] text-left table-fixed">
                                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 shadow-sm border-b border-slate-100">
                                                                <tr>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[10%]">Date</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[14%]">Type</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[8%]">No.</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[20%]">From/To</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[8%]">Status</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-[10%]">Amount</th>
                                                                    <th className="px-1.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[30%]">Memo</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingTransactions ? (
                                                                    [...Array(5)].map((_, i) => (
                                                                        <tr key={i}>
                                                                            <td className="px-1.5 py-2"><div className="w-14 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-1.5 py-2"><div className="w-16 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-1.5 py-2"><div className="w-8 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-1.5 py-2"><div className="w-20 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-1.5 py-2"><div className="w-10 h-3 bg-slate-100 rounded animate-pulse mx-auto" /></td>
                                                                            <td className="px-1.5 py-2 text-right"><div className="w-12 h-3 bg-slate-100 rounded animate-pulse ml-auto" /></td>
                                                                            <td className="px-1.5 py-2"><div className="w-24 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                        </tr>
                                                                    ))
                                                                ) : (() => {
                                                                    const q = txSearch.toLowerCase().trim();
                                                                    let filtered = transactions as any[];
                                                                    if (txTypeFilter.length > 0) filtered = filtered.filter((tx: any) => txTypeFilter.includes(tx.type));
                                                                    if (txStatusFilter.length > 0) filtered = filtered.filter((tx: any) => txStatusFilter.includes(tx.status));
                                                                    if (q) filtered = filtered.filter((tx: any) => 
                                                                        (tx.date && formatDateOnly(tx.date)?.toLowerCase().includes(q)) ||
                                                                        (tx.type && tx.type.toLowerCase().includes(q)) ||
                                                                        (tx.no && String(tx.no).toLowerCase().includes(q)) ||
                                                                        (tx.from && tx.from.toLowerCase().includes(q)) ||
                                                                        (tx.memo && tx.memo.toLowerCase().includes(q)) ||
                                                                        (tx.status && tx.status.toLowerCase().includes(q)) ||
                                                                        (tx.amount && String(tx.amount).includes(q))
                                                                    );
                                                                    return filtered.length > 0 ? (
                                                                        filtered.map((tx: any) => (
                                                                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                                                <td className="px-1.5 py-2 text-[11px] font-medium text-slate-600 whitespace-nowrap">{formatDateOnly(tx.date)}</td>
                                                                                <td className="px-1.5 py-2 text-[11px] font-medium whitespace-nowrap">
                                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                                                        tx.type === 'Payment' ? 'bg-teal-50 text-teal-700 border border-teal-200/50' : 
                                                                                        tx.type === 'Invoice' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                                                                                        tx.type === 'Bill' ? 'bg-orange-50 text-orange-700 border border-orange-200/50' : 
                                                                                        'bg-blue-50 text-blue-700 border border-blue-200/50'
                                                                                    }`}>
                                                                                        {tx.type}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-1.5 py-2 text-[11px] font-medium text-slate-600 whitespace-nowrap">#{tx.no}</td>
                                                                                <td className="px-1.5 py-2 text-[11px] font-medium text-slate-600 truncate">{tx.from || '—'}</td>
                                                                                <td className="px-1.5 py-2 text-center">
                                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                                                                        tx.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                                                                                        tx.status === 'Overdue' ? 'bg-rose-50 text-rose-700' :
                                                                                        'bg-amber-50 text-amber-700'
                                                                                    }`}>{tx.status}</span>
                                                                                </td>
                                                                                <td className="px-1.5 py-2 text-[11px] font-bold text-slate-800 text-right whitespace-nowrap">
                                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)}
                                                                                </td>
                                                                                <td className="px-1.5 py-2 text-[11px] font-medium text-slate-600 break-words">{tx.memo || '—'}</td>
                                                                            </tr>
                                                                        ))
                                                                    ) : (
                                                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">{txSearch || txTypeFilter.length > 0 || txStatusFilter.length > 0 ? 'No matching transactions.' : 'No transactions found.'}</td></tr>
                                                                    );
                                                                })()}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </Card>

                                                {/* DJT Box */}
                                                <Card className="flex flex-col h-full border border-slate-200 shadow-none overflow-hidden bg-white">
                                                    <div className="px-3 py-2 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 shrink-0">
                                                                <FileText size={16} className="text-amber-500" /> Tickets
                                                            </h3>
                                                            {(() => {
                                                                const tickets = selectedProject.jobTickets || [];
                                                                if (tickets.length === 0) return null;
                                                                const totalEquip = tickets.reduce((s: number, t: any) => s + (t.equipmentCost || 0), 0);
                                                                const totalOH = tickets.reduce((s: number, t: any) => s + (t.overheadCost || 0), 0);
                                                                const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
                                                                return (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">Equip {fmt(totalEquip)}</span>
                                                                        <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded whitespace-nowrap">OH {fmt(totalOH)}</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{(selectedProject.jobTickets || []).length} Records</span>
                                                    </div>
                                                    <div className="flex-1 overflow-auto bg-slate-50/30">
                                                        <table className="w-full min-w-[500px] text-left">
                                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 shadow-sm border-b border-slate-100">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipment</th>
                                                                    <th className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Overhead</th>
                                                                    <th className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total Cost</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingProfitability ? (
                                                                    [...Array(5)].map((_, i) => (
                                                                        <tr key={i}>
                                                                            <td className="p-4"><div className="w-16 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="p-4"><div className="w-14 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="p-4"><div className="w-14 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="p-4 text-right"><div className="w-16 h-3 bg-slate-100 rounded animate-pulse ml-auto" /></td>
                                                                        </tr>
                                                                    ))
                                                                ) : selectedProject.jobTickets && selectedProject.jobTickets.length > 0 ? (
                                                                    selectedProject.jobTickets.map((ticket, idx) => (
                                                                        <tr 
                                                                            key={idx} 
                                                                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                                                            onClick={() => {
                                                                                if (ticket.djtData) {
                                                                                    const djtWithSigs = { 
                                                                                        ...ticket.djtData, 
                                                                                        signatures: ticket.djtData.signatures || [],
                                                                                        schedule_id: ticket.schedule_id
                                                                                    };
                                                                                    setSelectedDJT(djtWithSigs);
                                                                                    setIsDjtEditMode(false);
                                                                                    setDjtModalOpen(true);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <td className="p-4 text-xs font-medium text-slate-600 group-hover:text-[#0F4C75]">{formatDateOnly(ticket.date)}</td>
                                                                            <td className="p-4 text-xs font-bold text-slate-700">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.equipmentCost)}
                                                                            </td>
                                                                            <td className="p-4 text-xs font-bold text-slate-700">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.overheadCost)}
                                                                            </td>
                                                                            <td className="p-4 text-xs font-black text-[#0F4C75] text-right">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.totalCost)}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 text-sm font-medium">No job tickets found.</td></tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </Card>
                                            </div>
                                        </div>
                                    </div>

                                ) : (
                                    <div className="flex-1 flex flex-col min-h-0">

                                        {/* Table Layout */}
                                        <div className="flex-1 min-h-0 mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                            <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
                                                <table className="w-full text-left border-collapse border border-slate-200 table-auto">
                                                    <thead className="sticky top-0 z-10 bg-white">
                                                        <tr className="bg-slate-50/50">
                                                            <th className="px-2 py-1.5 w-8 border border-slate-200"></th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('project') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Project</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('proposal-num') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Proposal #</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals estimate#</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('date') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Date</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('writers') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Proposal Writers</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals proposal writer</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('client') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Client</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-contract') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Original Contract</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals amount (latest version)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('change-orders') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Orders</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals change orders (sum of all change orders if status is completed or won)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('updated-contract') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 ml-auto"
                                                                        onMouseEnter={() => setActiveHighlight(['orig-contract', 'change-orders'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Updated Contract <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: Original Contract + Change Orders</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="w-full text-right"
                                                                        onMouseEnter={() => setActiveHighlight(['orig-contract', 'change-orders'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >Original Contract Cost</TooltipTrigger>
                                                                    <TooltipContent side="top">Original Contract + Change Orders</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('co-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Order Cost</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('total-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 ml-auto"
                                                                        onMouseEnter={() => setActiveHighlight(['orig-cost', 'co-cost'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Total Estimated Cost <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: Original Contract Cost + Change Order Cost</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Original Contract GP</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('co-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Order GP</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('est-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 ml-auto"
                                                                        onMouseEnter={() => setActiveHighlight(['updated-contract', 'total-cost'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Estimated GP <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: Updated Contract - Total Estimated Cost</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-800 uppercase tracking-tight text-right border border-slate-200 bg-[#D8E983] transition-colors ${activeHighlight.includes('revenue') ? 'bg-[#c1d35a]' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Revenue Earned to Date</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('cost-revenue') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Cost of Revenue Earned</TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[10px] font-bold">Sum of all QB Project Cost +</p>
                                                                            <p className="text-[10px] font-bold">Devco Owned Equipment & Overhead Cost</p>
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('gp-loss') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 ml-auto"
                                                                        onMouseEnter={() => setActiveHighlight(['revenue', 'cost-revenue'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Gross Profit (Loss) <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[10px]">Calculation: <span className="text-emerald-400 font-bold">Revenue Earned to Date</span> - <span className="text-rose-400 font-bold">Cost of Revenue Earned</span></p>
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('gp-pct') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 justify-center"
                                                                        onMouseEnter={() => setActiveHighlight(['gp-loss', 'revenue'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Gross Profit (%) <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: (Gross Profit (Loss) / Revenue Earned to Date) * 100</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('markup') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 justify-center"
                                                                        onMouseEnter={() => setActiveHighlight(['gp-loss', 'cost-revenue'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        Gross Markup on Cost (%) <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: (Gross Profit (Loss) / Cost of Revenue Earned) * 100</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('complete') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="flex items-center gap-1 justify-center"
                                                                        onMouseEnter={() => setActiveHighlight(['revenue', 'updated-contract'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >
                                                                        % Complete <HelpCircle size={8} className="text-slate-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Calculation: (Revenue Earned to Date / Updated Contract) * 100</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('sync') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-center">Sync</TooltipTrigger>
                                                                    <TooltipContent side="top">Press to live update the records with QuickBooks</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                                                        {loading ? (
                                                            Array.from({ length: 15 }).map((_, i) => (
                                                                <SkeletonTableRow key={i} columns={22} />
                                                            ))
                                                        ) : visibleProjects.length > 0 ? (
                                                            visibleProjects.map((project) => {
                                                                const originalContract = project.originalContract || 0;
                                                                const changeOrders = project.changeOrders || 0;
                                                                const updatedContract = originalContract + changeOrders;
                                                                
                                                                const originalContractCost = (project as any).originalContractCost || 0;
                                                                const changeOrderCost = 0;
                                                                const totalEstimatedCost = originalContractCost + changeOrderCost;
                                                                
                                                                const originalContractGP = originalContract - originalContractCost;
                                                                const changeOrderGP = 0;
                                                                const estimatedGP = updatedContract - totalEstimatedCost;
                                                                
                                                                const revenueToDate = project.income || 0;
                                                                const costOfRevenue = project.cost || 0;
                                                                const grossProfit = revenueToDate - costOfRevenue;
                                                                const grossProfitPct = revenueToDate > 0 ? (grossProfit / revenueToDate) * 100 : 0;
                                                                const grossMarkupPct = costOfRevenue > 0 ? (grossProfit / costOfRevenue) * 100 : 0;
                                                                const percentageComplete = updatedContract > 0 ? (revenueToDate / updatedContract) * 100 : 0;

                                                                const fmt = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
                                                                const cellBase = "px-2 py-1.5 text-[11px] whitespace-nowrap border border-slate-200 transition-colors";
                                                                const cellCls = `${cellBase} text-slate-800`;
                                                                const highlightCls = "bg-blue-100/30 font-bold text-blue-900";

                                                                return (
                                                                    <tr 
                                                                        id={`project-row-${project.Id}`}
                                                                        key={project.Id} 
                                                                        className={`transition-all duration-500 group ${highlightedProject === project.Id ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset z-10 scale-[1.005] shadow-sm relative' : 'hover:bg-slate-50/50'}`}
                                                                    >
                                                                        <td 
                                                                            className="px-2 py-1.5 text-center text-[11px] border border-slate-200"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button 
                                                                                className={`${project.isFavorite ? 'text-amber-400' : 'text-slate-300'} hover:text-amber-400 transition-colors`}
                                                                                onClick={(e) => { e.stopPropagation(); }}
                                                                            >
                                                                                <Star size={12} fill={project.isFavorite ? 'currentColor' : 'none'} />
                                                                            </button>
                                                                        </td>
                                                                        <td 
                                                                            className={`${cellCls} min-w-[120px] max-w-[150px] ${activeHighlight.includes('project') ? highlightCls : ''} cursor-pointer hover:bg-slate-100 transition-colors`}
                                                                            onClick={() => setSelectedProject(project)}
                                                                        >
                                                                            <div className="truncate text-[11px] font-semibold text-blue-800" title={project.DisplayName}>{project.DisplayName}</div>
                                                                        </td>
                                                                        <td 
                                                                            className={`${cellCls} ${activeHighlight.includes('proposal-num') ? highlightCls : ''}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex items-center gap-1.5">
                                                                                {editingProposalId === project.Id ? (
                                                                                    <input 
                                                                                        type="text"
                                                                                        value={editingProposalValue}
                                                                                        onChange={(e) => setEditingProposalValue(e.target.value)}
                                                                                        className="w-16 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] outline-none shadow-sm"
                                                                                        autoFocus
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveProposal(project.Id);
                                                                                            if (e.key === 'Escape') setEditingProposalId(null);
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <div 
                                                                                        className="cursor-pointer hover:underline text-[11px]"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setEditingProposalId(project.Id);
                                                                                            setEditingProposalValue(project.proposalNumber || '');
                                                                                        }}
                                                                                    >
                                                                                        {project.proposalNumber || '---'}
                                                                                    </div>
                                                                                )}

                                                                                {project.proposalSlug && (
                                                                                    <a 
                                                                                        href={`/estimates/${project.proposalSlug}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="p-0.5 hover:bg-slate-200 rounded transition-colors text-[#0F4C75]"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        <ExternalLink size={10} />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                         <td className={`${cellCls} ${activeHighlight.includes('date') ? highlightCls : ''}`}>{formatDateOnly(project.startDate)}</td>
                                                                        <td 
                                                                            className={`${cellCls} ${activeHighlight.includes('writers') ? highlightCls : ''}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex -space-x-1">
                                                                                {(project.proposalWriters || []).slice(0, 3).map((w, idx) => {
                                                                                    const employee = employees.find(e => 
                                                                                        `${e.firstName} ${e.lastName}`.toLowerCase() === w.toLowerCase() ||
                                                                                        e.email?.toLowerCase() === w.toLowerCase() ||
                                                                                        e._id?.toLowerCase() === w.toLowerCase()
                                                                                    );
                                                                                    const profilePic = employee?.profilePicture;
                                                                                    const displayName = employee ? `${employee.firstName} ${employee.lastName}` : w;
                                                                                    
                                                                                    return (
                                                                                        <Tooltip key={idx}>
                                                                                            <TooltipTrigger asChild>
                                                                                                <div className="w-6 h-6 rounded-full bg-[#0F4C75] border-2 border-white flex items-center justify-center text-[9px] text-white font-black shadow-sm overflow-hidden cursor-help">
                                                                                                    {profilePic ? (
                                                                                                        <img src={profilePic} alt={displayName} className="w-full h-full object-cover" />
                                                                                                    ) : (
                                                                                                        displayName.substring(0, 1).toUpperCase()
                                                                                                    )}
                                                                                                </div>
                                                                                            </TooltipTrigger>
                                                                                            <TooltipContent side="top">
                                                                                                <p>{displayName}</p>
                                                                                            </TooltipContent>
                                                                                        </Tooltip>
                                                                                    );
                                                                                })}
                                                                                {(project.proposalWriters || []).length > 3 && (
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] text-slate-600 font-bold shadow-sm cursor-help">
                                                                                               +{(project.proposalWriters || []).length - 3}
                                                                                            </div>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent side="top">
                                                                                            <p>{(project.proposalWriters || []).slice(3).map(w => {
                                                                                                const employee = employees.find(e => 
                                                                                                    `${e.firstName} ${e.lastName}`.toLowerCase() === w.toLowerCase() ||
                                                                                                    e.email?.toLowerCase() === w.toLowerCase() ||
                                                                                                    e._id?.toLowerCase() === w.toLowerCase()
                                                                                                );
                                                                                                return employee ? `${employee.firstName} ${employee.lastName}` : w;
                                                                                            }).join(', ')}</p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className={`${cellCls} max-w-[100px] truncate ${activeHighlight.includes('client') ? highlightCls : ''}`}>{project.CompanyName || '---'}</td>
                                                                        <td 
                                                                            className={`${cellCls} text-right ${activeHighlight.includes('orig-contract') ? highlightCls : ''} cursor-pointer hover:bg-blue-50`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onDoubleClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingContractId(project.Id);
                                                                                setEditingValue(originalContract.toString());
                                                                            }}
                                                                        >
                                                                            {editingContractId === project.Id ? (
                                                                                <input 
                                                                                    type="text"
                                                                                    value={editingValue}
                                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                                    onBlur={() => handleSaveManualValue(project.Id, 'originalContract', editingValue)}
                                                                                    onKeyDown={(e) => {
                                                                                        if(e.key === 'Enter') handleSaveManualValue(project.Id, 'originalContract', editingValue);
                                                                                        if(e.key === 'Escape') setEditingContractId(null);
                                                                                    }}
                                                                                    autoFocus
                                                                                    className="w-full text-right bg-white border border-blue-400 rounded px-1 py-0 text-[11px] outline-none"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                            ) : (
                                                                                project.isManualOriginalContract ? <span className="text-blue-500 font-bold">{fmt(originalContract)}</span> : fmt(originalContract)
                                                                            )}
                                                                        </td>
                                                                        <td 
                                                                            className={`${cellCls} text-right ${activeHighlight.includes('change-orders') ? highlightCls : ''} cursor-pointer hover:bg-blue-50`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onDoubleClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingChangeOrderId(project.Id);
                                                                                setEditingValue(changeOrders.toString());
                                                                            }}
                                                                        >
                                                                            {editingChangeOrderId === project.Id ? (
                                                                                <input 
                                                                                    type="text"
                                                                                    value={editingValue}
                                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                                    onBlur={() => handleSaveManualValue(project.Id, 'changeOrders', editingValue)}
                                                                                    onKeyDown={(e) => {
                                                                                        if(e.key === 'Enter') handleSaveManualValue(project.Id, 'changeOrders', editingValue);
                                                                                        if(e.key === 'Escape') setEditingChangeOrderId(null);
                                                                                    }}
                                                                                    autoFocus
                                                                                    className="w-full text-right bg-white border border-blue-400 rounded px-1 py-0 text-[11px] outline-none"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                />
                                                                            ) : (
                                                                                project.isManualChangeOrders ? <span className="text-blue-500 font-bold">{fmt(changeOrders)}</span> : fmt(changeOrders)
                                                                            )}
                                                                        </td>
                                                                        <td className={`${cellCls} text-right font-bold ${activeHighlight.includes('updated-contract') ? highlightCls : ''}`}>{fmt(updatedContract)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('orig-cost') ? highlightCls : ''}`}>{fmt(originalContractCost)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('co-cost') ? highlightCls : ''}`}>{fmt(changeOrderCost)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('total-cost') ? highlightCls : ''}`}>{fmt(totalEstimatedCost)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('orig-gp') ? highlightCls : ''}`}>{fmt(originalContractGP)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('co-gp') ? highlightCls : ''}`}>{fmt(changeOrderGP)}</td>
                                                                        <td className={`${cellCls} text-right font-bold ${activeHighlight.includes('est-gp') ? highlightCls : ''}`}>{fmt(estimatedGP)}</td>
                                                                        <td className={`${cellBase} text-right font-black bg-[#D8E983] text-slate-900 ${activeHighlight.includes('revenue') ? 'bg-[#c1d35a]' : ''}`}>{fmt(revenueToDate)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('cost-revenue') ? highlightCls : ''}`}>{fmt(costOfRevenue)}</td>
                                                                        <td className={`${cellBase} text-right font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} ${activeHighlight.includes('gp-loss') ? highlightCls : ''}`}>{fmt(grossProfit)}</td>
                                                                        <td className={`${cellBase} text-center font-bold ${grossProfitPct >= 0 ? 'text-emerald-600' : 'text-rose-600'} ${activeHighlight.includes('gp-pct') ? highlightCls : ''}`}>{grossProfitPct.toFixed(1)}%</td>
                                                                        <td className={`${cellCls} text-center ${activeHighlight.includes('markup') ? highlightCls : ''}`}>{grossMarkupPct.toFixed(1)}%</td>
                                                                        <td className={`${cellCls} text-center ${activeHighlight.includes('complete') ? highlightCls : ''}`}>{percentageComplete.toFixed(0)}%</td>
                                                                        <td 
                                                                            className={`p-1.5 text-center border border-slate-200 transition-colors ${activeHighlight.includes('sync') ? highlightCls : ''}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    syncIndividualProject(project.Id);
                                                                                }}
                                                                                disabled={syncingProjectId === project.Id}
                                                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-50"
                                                                            >
                                                                                <RefreshCw className={`w-2.5 h-2.5 ${syncingProjectId === project.Id ? 'animate-spin' : ''}`} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={22} className="p-20 text-center">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <Briefcase size={48} className="text-slate-200" />
                                                                        <span className="text-slate-400 font-bold">No projects found.</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {/* Infinite scroll sentinel */}
                                                        {!loading && (
                                                            <tr ref={sentinelRef} style={{ height: 1 }}>
                                                                <td colSpan={22}>
                                                                    {hasMore && (
                                                                        <div className="flex items-center justify-center py-4">
                                                                            <div className="w-5 h-5 border-2 border-slate-300 border-t-[#0F4C75] rounded-full animate-spin" />
                                                                            <span className="ml-2 text-[10px] font-bold text-slate-400">Loading more...</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table Footer - count info */}
                                            {filteredProjects.length > 0 && (
                                                <div className="py-2 px-4 border-t border-slate-50 flex items-center justify-between bg-white">
                                                    <span className="text-[10px] font-bold text-slate-500">
                                                        Showing <span className="text-slate-900">{Math.min(visibleCount, filteredProjects.length)}</span> of <span className="text-slate-900">{filteredProjects.length}</span> projects
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
                
                {selectedDJT && (
                    <DJTModal
                        isOpen={djtModalOpen}
                        onClose={() => setDjtModalOpen(false)}
                        selectedDJT={selectedDJT}
                        setSelectedDJT={setSelectedDJT}
                        isEditMode={isDjtEditMode}
                        setIsEditMode={setIsDjtEditMode}
                        schedules={[]} // We don't have all schedules here, but the modal handles fallbacks
                        handleSave={handleSaveDJT}
                        initialData={{
                            employees: employees.map(e => ({ 
                                label: e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.email, 
                                value: e.email, 
                                image: e.profilePicture 
                            })),
                            equipmentItems: equipmentMachines.map(m => ({ 
                                label: m.equipmentMachine || m.name, 
                                value: m._id, 
                                dailyCost: m.dailyCost 
                            }))
                        }}
                        handleSaveSignature={handleSaveDJTSignature}
                        activeSignatureEmployee={activeSignatureEmployee}
                        setActiveSignatureEmployee={setActiveSignatureEmployee}
                        isSavingSignature={isSavingSignature}
                        isGeneratingPDF={isGeneratingDJTPDF}
                        handleDownloadPDF={handleDownloadDjtPdf}
                    />
                )}
            </TooltipProvider>
        </div>
    );
}
