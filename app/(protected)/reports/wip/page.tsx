
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
    FileText, Target, TrendingUp, Zap, HelpCircle, PieChart as PieChartIcon, Info 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Skeleton, SkeletonTableRow, SkeletonTable } from '@/components/ui';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
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

function WIPReportContent() {
    const [activeTab, setActiveTab] = useState('wip');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState('Summary');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [isExporting, setIsExporting] = useState(false);

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
    const [employees, setEmployees] = useState<any[]>([]);
    const [equipmentMachines, setEquipmentMachines] = useState<any[]>([]);
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

    const fetchEmployees = async () => {
        try {
            const res = await fetch(`/api/employees`);
            const data = await res.json();
            if (data.success) {
                setEmployees(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const fetchEquipment = async () => {
        try {
            const res = await fetch(`/api/catalogue?type=${'equipment'}`);
            const data = await res.json();
            if (data.success) {
                setEquipmentMachines(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching equipment:', err);
        }
    };

    useEffect(() => {
        fetchProjects();
        fetchEmployees();
        fetchEquipment();
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
    }, [hasMore, visibleCount]);

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <TooltipProvider>
            <Header 
                showDashboardActions={true} 
                wipReportFilters={{
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
                }}
            />
            
            <main className="flex-1 flex flex-col min-h-0 p-4 bg-[#f8fafc]">
                <div className="flex-1 flex flex-col min-h-0 space-y-6">
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
                                    /* Project Detail View */
                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
                                        {/* Header Navigation */}
                                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                                            <div className="flex items-center gap-6">
                                                <button 
                                                    onClick={() => setSelectedProject(null)}
                                                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all group"
                                                >
                                                    <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
                                                </button>
                                                <div className="h-8 w-px bg-slate-200"></div>
                                                <div className="flex items-center gap-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</span>
                                                        <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                                                            <Briefcase size={14} className="text-[#0F4C75]" />
                                                            {selectedProject.CompanyName || selectedProject.DisplayName.split(':')?.[0] || '---'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Proposal ID</span>
                                                        <span className="text-sm font-black text-[#0F4C75] flex items-center gap-2">
                                                            <FileText size={14} />
                                                            {selectedProject.proposalNumber || '---'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Proposal Writer</span>
                                                        <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                                                            <Users size={14} className="text-emerald-500" />
                                                            {(selectedProject.proposalWriters || []).join(', ') || '---'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">{selectedProject.status || 'Active'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                                            {/* KPI Row */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                {/* Income */}
                                                <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow bg-white">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</span>
                                                    <div className="text-3xl font-black text-slate-800 mt-2 tracking-tight">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(selectedProject.income || 0)}
                                                    </div>
                                                </Card>
                                                {/* Cost (QB Costs) */}
                                                <Card className="p-6 border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow bg-white">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost</span>
                                                    <div className="text-3xl font-black text-slate-800 mt-2 tracking-tight">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(selectedProject.qbCost || 0)}
                                                    </div>
                                                </Card>
                                                {/* Overhead (Devco Costs) */}
                                                <Card className="p-6 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow bg-white">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overhead</span>
                                                    <div className="text-3xl font-black text-slate-800 mt-2 tracking-tight">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(selectedProject.devcoCost || 0)}
                                                    </div>
                                                </Card>
                                                {/* Profit */}
                                                <Card className="p-6 border-l-4 border-l-[#0F4C75] shadow-sm hover:shadow-md transition-shadow bg-white relative">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profit</span>
                                                    <div className="text-3xl font-black text-[#0F4C75] mt-2 tracking-tight">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((selectedProject.income || 0) - (selectedProject.cost || 0))}
                                                    </div>
                                                    <div className="absolute top-6 right-6 px-2 py-1 bg-blue-50 text-[#0F4C75] rounded text-xs font-black">
                                                        {selectedProject.profitMargin}%
                                                    </div>
                                                </Card>
                                            </div>

                                            {/* 2 Boxes: Transactions & Daily Job Tickets */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px] min-h-[500px]">
                                                {/* Transactions Box */}
                                                <Card className="flex flex-col h-full border border-slate-200 shadow-sm overflow-hidden bg-white">
                                                    <div className="px-5 py-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                            <Briefcase size={16} className="text-[#0F4C75]" /> Transactions
                                                        </h3>
                                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{transactions.length} Records</span>
                                                    </div>
                                                    <div className="flex-1 overflow-auto bg-slate-50/30">
                                                        <table className="w-full text-left">
                                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 shadow-sm border-b border-slate-100">
                                                                <tr>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingTransactions ? (
                                                                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-sm">Loading...</td></tr>
                                                                ) : transactions.length > 0 ? (
                                                                    transactions.map((tx: any) => (
                                                                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="p-4 text-xs font-medium text-slate-600">{formatDateOnly(tx.date)}</td>
                                                                            <td className="p-4 text-xs font-bold text-slate-800 flex items-center gap-2">
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${tx.type === 'Payment' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                                                                                {tx.type} <span className="text-slate-400 font-normal text-[10px]">#{tx.no}</span>
                                                                            </td>
                                                                            <td className="p-4 text-xs font-black text-slate-900 text-right">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-sm font-medium">No transactions found.</td></tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </Card>

                                                {/* DJT Box */}
                                                <Card className="flex flex-col h-full border border-slate-200 shadow-sm overflow-hidden bg-white">
                                                    <div className="px-5 py-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                            <FileText size={16} className="text-amber-500" /> Daily Job Tickets
                                                        </h3>
                                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{(selectedProject.jobTickets || []).length} Tickets</span>
                                                    </div>
                                                    <div className="flex-1 overflow-auto bg-slate-50/30">
                                                        <table className="w-full text-left">
                                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 shadow-sm border-b border-slate-100">
                                                                <tr>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipment</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Overhead</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total Cost</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingProfitability ? (
                                                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">Loading...</td></tr>
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
                                                                        key={project.Id} 
                                                                        className="hover:bg-slate-50/50 transition-colors group"
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

export default function WIPReportPage() {
    return (
        <Suspense fallback={<Loading />}>
            <WIPReportContent />
        </Suspense>
    );
}

