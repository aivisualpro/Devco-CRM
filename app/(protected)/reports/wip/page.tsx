
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
    const [transactions, setTransactions] = useState<any[]>([]);
    const [endDateFilter, setEndDateFilter] = useState('All');
    const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
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
                    startDate: new Date(p.MetaData.CreateTime).toLocaleDateString(),
                    endDate: new Date(new Date(p.MetaData.CreateTime).getTime() + 86400000 * 30).toLocaleDateString(),
                    isFavorite: Math.random() > 0.8
                })).sort((a: any, b: any) => 
                    new Date(b.MetaData.CreateTime).getTime() - new Date(a.MetaData.CreateTime).getTime()
                );
                
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
                            income: updatedProject.income || 0,
                            cost: updatedProject.cost || 0,
                            profitMargin: updatedProject.profitMargin || 0,
                            proposalNumber: updatedProject.proposalNumber,
                            proposalWriters: updatedProject.proposalWriters || [],
                            originalContract: updatedProject.originalContract || 0,
                            changeOrders: updatedProject.changeOrders || 0,
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
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEmployees' })
            });
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
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'equipment' } })
            });
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
                createdBy: 'WIP Report' 
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
            
            // Build variables
            const variables: Record<string, any> = {
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',
                customerName: selectedProject?.DisplayName || '',
                jobLocation: selectedDJT.jobLocation || '',
                estimate: selectedProject?.proposalNumber || '',
                date: new Date(selectedDJT.date || new Date()).toLocaleDateString(),
            };

            if (selectedDJT.customerSignature) {
                variables['customerSignature'] = selectedDJT.customerSignature;
            }

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
        setCurrentPage(1);
    };

    // Pagination logic
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginatedProjects = filteredProjects.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, dateRangeFilter]);

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
                    clearFilters
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
                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                        {/* Detail Tabs & Navigation */}
                                        <div className="flex items-center px-4 border-b border-slate-100 overflow-x-auto shrink-0 bg-white sticky top-0 z-10">
                                            <button 
                                                onClick={() => setSelectedProject(null)}
                                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all mr-2 group"
                                                title="Back to Projects"
                                            >
                                                <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
                                            </button>
                                            
                                            <div className="flex items-center gap-2 mr-6 border-r border-slate-100 pr-6 py-4">
                                                <DollarSign className="w-4 h-4 text-emerald-500" />
                                                <span className="text-sm font-black text-slate-900 truncate max-w-[200px]">
                                                    {selectedProject.DisplayName}
                                                </span>
                                            </div>

                                            {detailTabs.map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveDetailTab(tab)}
                                                    className={`px-4 py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${
                                                        activeDetailTab === tab 
                                                        ? 'text-[#0F4C75]' 
                                                        : 'text-slate-500 hover:text-slate-800'
                                                    }`}
                                                >
                                                    {tab}
                                                    {activeDetailTab === tab && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full"></div>
                                                    )}
                                                </button>
                                            ))}
                                            <div className="flex-1"></div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/30">

                                            {activeDetailTab === 'Transactions' && (
                                                <>
                                                    {/* Detail View Sub-header */}
                                                    <div className="p-6 border-b border-slate-50 space-y-4">
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">
                                                                Batch actions <ChevronDown size={14} />
                                                            </button>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Type</span>
                                                                <select className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none w-40">
                                                                    <option>All transactions</option>
                                                                    <option>Invoices</option>
                                                                    <option>Payments</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
                                                                <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none w-48">
                                                                    <option>All</option>
                                                                    <option>Today</option>
                                                                    <option>This Month</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex-1"></div>
                                                            <button className="text-[#0F4C75] text-xs font-bold hover:underline">View Recurring Templates</button>
                                                        </div>
                                                    </div>

                                                    {/* Transactions Table */}
                                                    <div className="overflow-x-auto min-h-[400px]">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="border-b border-slate-100 bg-slate-50/30">
                                                                    <th className="p-4 w-10">
                                                                        <input type="checkbox" className="rounded border-slate-300" />
                                                                    </th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">No.</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">From / To</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Memo</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Amount</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingTransactions ? (
                                                                    Array.from({ length: 5 }).map((_, i) => (
                                                                        <SkeletonTableRow key={i} columns={9} />
                                                                    ))
                                                                ) : transactions.length > 0 ? (
                                                                    transactions.map((tx: any) => (
                                                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                                            <td className="p-4">
                                                                                <input type="checkbox" className="rounded border-slate-300" />
                                                                            </td>
                                                                            <td className="p-4 text-[11px] font-medium text-slate-600">
                                                                                {new Date(tx.date).toLocaleDateString()}
                                                                            </td>
                                                                            <td className="p-4 text-[11px] font-bold text-slate-800">{tx.type}</td>
                                                                            <td className="p-4 text-[11px] font-medium text-slate-600">{tx.no}</td>
                                                                            <td className="p-4 text-[11px] font-medium text-slate-500 max-w-xs truncate">{tx.from}</td>
                                                                            <td className="p-4 text-[11px] font-medium text-slate-400 max-w-xs truncate">{tx.memo}</td>
                                                                            <td className="p-4 text-[11px] font-black text-slate-900">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)}
                                                                            </td>
                                                                            <td className="p-4">
                                                                                {tx.status && (
                                                                                    <div className={`flex items-center gap-2 text-[10px] font-medium ${
                                                                                        tx.statusColor === 'emerald' ? 'text-emerald-600' : 'text-amber-600'
                                                                                    }`}>
                                                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                                                            tx.statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                                                                                        }`}></div>
                                                                                        {tx.status}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-4">
                                                                                <div className="flex items-center justify-end gap-2">
                                                                                    <button className="text-[10px] font-bold text-[#0F4C75] hover:underline">View/Edit</button>
                                                                                    <button className="p-1 text-slate-400"><ChevronDown size={12} /></button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan={9} className="p-20 text-center">
                                                                            <div className="flex flex-col items-center gap-2">
                                                                                <Search size={40} className="text-slate-200" />
                                                                                <span className="text-slate-400 text-xs font-bold">No transactions found for this project.</span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Pagination Footer */}
                                                    <div className="p-4 border-t border-slate-50 flex items-center justify-between">
                                                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <button disabled className="hover:text-slate-800">First</button>
                                                            <button disabled className="hover:text-slate-800">Previous</button>
                                                        </div>
                                                        <div className="text-[11px] font-bold text-slate-600">{transactions.length > 0 ? `1-${transactions.length} of ${transactions.length}` : '0-0 of 0'}</div>
                                                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <button disabled className="hover:text-slate-800">Next</button>
                                                            <button disabled className="hover:text-slate-800">Last</button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {activeDetailTab === 'Summary' && (
                                                <div className="p-4 space-y-12 animate-fade-in w-full">
                                                    {(() => {
                                                        const originalContractValue = selectedProject.originalContract || 0;
                                                        const changeOrdersValue = selectedProject.changeOrders || 0;
                                                        const updatedContractValue = originalContractValue + changeOrdersValue;
                                                        const originalContractCostValue = (selectedProject as any).originalContractCost || 0;
                                                        const changeOrderCostValue = 0;
                                                        const totalEstimatedCostValue = originalContractCostValue + changeOrderCostValue;
                                                        const estimatedGPValue = updatedContractValue - totalEstimatedCostValue;
                                                        
                                                        const revenueToDateValue = selectedProject.income || 0;
                                                        const costOfRevenueValue = selectedProject.cost || 0;
                                                        const grossProfitValue = revenueToDateValue - costOfRevenueValue;
                                                        const grossProfitPctValue = revenueToDateValue > 0 ? (grossProfitValue / revenueToDateValue) * 100 : 0;
                                                        const grossMarkupPctValue = costOfRevenueValue > 0 ? (grossProfitValue / costOfRevenueValue) * 100 : 0;
                                                        const percentageCompleteValue = updatedContractValue > 0 ? (revenueToDateValue / updatedContractValue) * 100 : 0;

                                                        const fmtDetail = (val: number) => new Intl.NumberFormat('en-US', { 
                                                            style: 'currency', 
                                                            currency: 'USD', 
                                                            minimumFractionDigits: 0, 
                                                            maximumFractionDigits: 0 
                                                        }).format(val);

                                                        return (
                                                            <div className="space-y-8">
                                                                {/* Interactive Project Identity Header */}
                                                                <div className="relative group">
                                                                    <div className="absolute -inset-1 bg-gradient-to-r from-[#0F4C75] via-[#3282B8] to-emerald-500 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                                                    <div className="relative flex flex-wrap items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                                                                        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 max-w-[200px]">
                                                                            <div className="p-2 bg-blue-500 rounded-lg text-white">
                                                                                <Briefcase size={18} />
                                                                            </div>
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</span>
                                                                                <span className="text-sm font-black text-slate-700 truncate">{selectedProject.CompanyName || selectedProject.DisplayName.split(':')?.[0] || '---'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                                                                            <div className="p-2 bg-[#0F4C75] rounded-lg text-white">
                                                                                <FileText size={18} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proposal ID</span>
                                                                                <span className="text-sm font-black text-[#0F4C75]">{selectedProject.proposalNumber || '---'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                                                                            <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                                                                <Users size={18} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proposal Writers</span>
                                                                                <span className="text-sm font-black text-slate-700 max-w-[150px] truncate">{selectedProject.proposalWriters?.join(', ') || '---'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                                                                            <div className="p-2 bg-amber-500 rounded-lg text-white">
                                                                                <Calendar size={18} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
                                                                                <span className="text-sm font-black text-slate-700">{selectedProject.startDate || '---'}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex-1 flex justify-end items-center gap-6 min-w-[300px]">
                                                                            <div className="text-right">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contract Status</span>
                                                                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                                                    <span className="text-[10px] font-bold uppercase">{selectedProject.status || 'Active'}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="h-12 w-[2px] bg-slate-100 mx-2"></div>
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% COMPLETE</span>
                                                                                <div className="relative w-16 h-16 flex items-center justify-center">
                                                                                    <svg className="w-full h-full transform -rotate-90">
                                                                                        <circle
                                                                                            cx="32" cy="32" r="28"
                                                                                            stroke="currentColor"
                                                                                            strokeWidth="4"
                                                                                            fill="transparent"
                                                                                            className="text-slate-100"
                                                                                        />
                                                                                        <circle
                                                                                            cx="32" cy="32" r="28"
                                                                                            stroke="currentColor"
                                                                                            strokeWidth="4"
                                                                                            fill="transparent"
                                                                                            strokeDasharray={2 * Math.PI * 28}
                                                                                            strokeDashoffset={2 * Math.PI * 28 * (1 - percentageCompleteValue / 100)}
                                                                                            strokeLinecap="round"
                                                                                            className="text-emerald-500 transition-all duration-1000"
                                                                                        />
                                                                                    </svg>
                                                                                    <span className="absolute text-[11px] font-black text-slate-700">{Math.round(percentageCompleteValue)}%</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Financial Metrics Grid */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                                    {/* Column 1: Contract Analysis */}
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                                                            <Briefcase size={12} /> Contract Matrix
                                                                        </h4>
                                                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-all">
                                                                            <div className="flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">ORIGINAL</span>
                                                                                <span className="text-sm font-black text-slate-900">{fmtDetail(originalContractValue)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center bg-amber-50/50 px-3 py-2 rounded-xl border border-amber-100/50 group cursor-help">
                                                                                <span className="text-[11px] font-bold text-amber-700">CHANGE ORDERS</span>
                                                                                <span className="text-sm font-black text-amber-600">+{fmtDetail(changeOrdersValue)}</span>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-slate-50 flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-black text-[#0F4C75]">UPDATED TOTAL</span>
                                                                                <span className="text-lg font-black text-[#0F4C75]">{fmtDetail(updatedContractValue)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 2: Estimation & Costing */}
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                                                            <Target size={12} /> Projected Costs
                                                                        </h4>
                                                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-all">
                                                                            <div className="flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">ESTIMATED COST</span>
                                                                                <span className="text-sm font-black text-slate-900">{fmtDetail(originalContractCostValue)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">CO EST. COST</span>
                                                                                <span className="text-sm font-black text-slate-900">{fmtDetail(changeOrderCostValue)}</span>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-slate-50 flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-black text-[#0F4C75]">TOTAL ESTIMATED</span>
                                                                                <span className="text-lg font-black text-[#0F4C75]">{fmtDetail(totalEstimatedCostValue)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 3: Gross Profit DNA */}
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                                                            <TrendingUp size={12} /> Profit Analysis
                                                                        </h4>
                                                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-all">
                                                                            <div className="flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">CONTRACT GP</span>
                                                                                <span className="text-sm font-black text-slate-900">{fmtDetail(originalContractValue - originalContractCostValue)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">ESTIMATED CO GP</span>
                                                                                <span className="text-sm font-black text-slate-900">{fmtDetail(0)}</span>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-slate-50 flex justify-between items-center group cursor-help">
                                                                                <span className="text-[11px] font-black text-emerald-600">TOTAL EST. GP</span>
                                                                                <span className="text-lg font-black text-emerald-600">{fmtDetail(estimatedGPValue)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 4: Efficiency Specs */}
                                                                    <div className="space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                                                            <Zap size={12} /> Efficiency Specs
                                                                        </h4>
                                                                        <div className="bg-[#D8E983] p-5 rounded-2xl border border-[#D8E983] shadow-sm space-y-3 relative overflow-hidden group hover:shadow-[#D8E983]/30 transition-all">
                                                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
                                                                                <Zap size={60} className="fill-[#0F4C75]" />
                                                                            </div>
                                                                            <div className="flex justify-between items-center relative z-10">
                                                                                <span className="text-[10px] font-black text-[#0F4C75] uppercase tracking-tighter">Gross Profit %</span>
                                                                                <span className="text-xl font-black text-[#0F4C75]">{grossProfitPctValue.toFixed(1)}%</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center relative z-10">
                                                                                <span className="text-[10px] font-black text-[#0F4C75] uppercase tracking-tighter">Markup on Cost</span>
                                                                                <span className="text-xl font-black text-[#0F4C75]">{grossMarkupPctValue.toFixed(1)}%</span>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-[#0F4C75]/10 flex justify-between items-center relative z-10">
                                                                                <span className="text-[10px] font-black text-[#0F4C75] uppercase">Actual GP</span>
                                                                                <span className="text-sm font-black text-[#0F4C75]">{fmtDetail(grossProfitValue)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    
                                                    {/* Project Balance Summary Section */}
                                                    <div className="space-y-6">
                                                        <div className="flex flex-col lg:flex-row items-stretch gap-4">
                                                            {/* Income Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col p-6 space-y-5 z-10 transition-all duration-300">
                                                                        <Skeleton className="h-4 w-20 rounded-full" />
                                                                        <Skeleton className="h-10 w-3/4 rounded-xl" />
                                                                        <Skeleton className="h-2.5 w-full rounded-full" />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INCOME</span>
                                                                    <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.income || 0)}
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-emerald-500 rounded-full w-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                                                                </div>
                                                            </Card>

                                                            {/* Operator - */}
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 font-bold shrink-0 shadow-inner self-center">
                                                                <span className="text-xl">−</span>
                                                            </div>

                                                            {/* QB Costs Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col p-6 space-y-5 z-10 transition-all duration-300">
                                                                        <Skeleton className="h-4 w-20 rounded-full" />
                                                                        <Skeleton className="h-10 w-3/4 rounded-xl" />
                                                                        <Skeleton className="h-2.5 w-full rounded-full" />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">QB COSTS</span>
                                                                    <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.qbCost || 0)}
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                                                                        style={{ width: `${((selectedProject.qbCost || 0) / (selectedProject.income || 1)) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </Card>

                                                            {/* Operator - */}
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 font-bold shrink-0 shadow-inner self-center">
                                                                <span className="text-xl">−</span>
                                                            </div>

                                                            {/* Devco Costs Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col p-6 space-y-5 z-10 transition-all duration-300">
                                                                        <Skeleton className="h-4 w-32 rounded-full" />
                                                                        <Skeleton className="h-10 w-3/4 rounded-xl" />
                                                                        <Skeleton className="h-2.5 w-full rounded-full" />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">(Overheads + Equipment cost)</span>
                                                                    <div className="space-y-1">
                                                                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.devcoCost || 0)}
                                                                        </div>
                                                                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                                                                            {(selectedProject.jobTickets || []).length} Job Tickets
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                                                        style={{ width: `${((selectedProject.devcoCost || 0) / (selectedProject.income || 1)) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </Card>

                                                            {/* Operator = */}
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 font-bold shrink-0 shadow-inner self-center">
                                                                <span className="text-xl">=</span>
                                                            </div>

                                                            {/* Profit Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col p-6 space-y-5 z-10 transition-all duration-300">
                                                                        <Skeleton className="h-4 w-20 rounded-full" />
                                                                        <Skeleton className="h-10 w-3/4 rounded-xl" />
                                                                        <div className="pt-4 space-y-4">
                                                                            <Skeleton className="h-3 w-28 rounded-full" />
                                                                            <Skeleton className="h-6 w-12 rounded-lg" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PROFIT</span>
                                                                    <div className="text-3xl font-black text-[#0F4C75] tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((selectedProject.income || 0) - (selectedProject.cost || 0))}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1 text-[10px] font-black tracking-tighter">
                                                                    <span className="text-slate-400 uppercase block">Actual profit margin</span>
                                                                    <span className="text-slate-900 text-lg">{selectedProject.profitMargin}%</span>
                                                                </div>
                                                            </Card>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Charts & Health Section */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        {/* Breakdowns Column */}
                                                        <div className="space-y-6">
                                                            <Card className="p-6 space-y-6">
                                                                <div className="flex items-center gap-2">
                                                                    <PieChartIcon className="w-5 h-5 text-[#0F4C75]" />
                                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Profit Breakdown</h3>
                                                                </div>
                                                                
                                                                <div className="h-[250px] w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <PieChart>
                                                                            <Pie
                                                                                data={[
                                                                                    { name: 'QB Costs', value: selectedProject.qbCost || 0 },
                                                                                    { name: 'Devco Costs', value: selectedProject.devcoCost || 0 },
                                                                                    { name: 'Profit', value: Math.max(0, (selectedProject.income || 0) - (selectedProject.cost || 0)) }
                                                                                ].filter(d => d.value > 0)}
                                                                                cx="50%"
                                                                                cy="50%"
                                                                                innerRadius={60}
                                                                                outerRadius={80}
                                                                                paddingAngle={5}
                                                                                dataKey="value"
                                                                            >
                                                                                <Cell fill="#14B8A6" /> {/* QB Costs - Teal */}
                                                                                <Cell fill="#F59E0B" /> {/* Devco Costs - Amber */}
                                                                                <Cell fill="#0F4C75" /> {/* Profit - Blue */}
                                                                            </Pie>
                                                                            <RechartsTooltip 
                                                                                formatter={(value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                                                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                                            />
                                                                            <Legend 
                                                                                verticalAlign="bottom" 
                                                                                height={36}
                                                                                iconType="circle"
                                                                                formatter={(value) => <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{value}</span>}
                                                                            />
                                                                        </PieChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </Card>
                                                        </div>

                                                        {/* Status & Info Column */}
                                                        <Card className="p-6 space-y-6">
                                                            <div className="flex items-center gap-2">
                                                                <Settings className="w-5 h-5 text-slate-400" />
                                                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Project Health</h3>
                                                            </div>
                                                            
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-[10px] font-bold">
                                                                        <span className="text-slate-400 uppercase">Cost Burn</span>
                                                                        <span className="text-slate-900">{( (selectedProject.cost || 0) / (selectedProject.income || 1) * 100).toFixed(1)}%</span>
                                                                    </div>
                                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-amber-500 rounded-full" 
                                                                            style={{ width: `${Math.min(100, (selectedProject.cost || 0) / (selectedProject.income || 1) * 100)}%` }}
                                                                        ></div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-slate-50 grid grid-cols-1 gap-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Proposal Status</span>
                                                                        <span className="text-sm font-black text-slate-900">{selectedProject.status || 'Active'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Start Date</span>
                                                                        <span className="text-sm font-black text-slate-900">{selectedProject.startDate || '---'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">QuickBooks ID</span>
                                                                        <span className="text-sm font-black text-slate-900">{selectedProject.Id}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </div>
                                                </div>
                                            )}

                                            {activeDetailTab === 'Daily Job Tickets' && (
                                                <div className="p-6 space-y-6 animate-fade-in">
                                                    <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipment Cost</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Overhead Cost</th>
                                                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Cost</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingProfitability ? (
                                                                    Array.from({ length: 5 }).map((_, i) => (
                                                                        <SkeletonTableRow key={i} columns={4} />
                                                                    ))
                                                                ) : selectedProject.jobTickets && selectedProject.jobTickets.length > 0 ? (
                                                                    selectedProject.jobTickets.map((ticket, idx) => (
                                                                        <tr 
                                                                            key={idx} 
                                                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                                                            onClick={() => {
                                                                                if (ticket.djtData) {
                                                                                    // Format for DJTModal exactly as expected by other components
                                                                                    const djtWithSigs = { 
                                                                                        ...ticket.djtData, 
                                                                                        signatures: ticket.djtData.signatures || [],
                                                                                        // Ensure we have a reference to the schedule if needed
                                                                                        schedule_id: ticket.schedule_id
                                                                                    };
                                                                                    setSelectedDJT(djtWithSigs);
                                                                                    setIsDjtEditMode(false);
                                                                                    setDjtModalOpen(true);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <td className="p-4 text-[11px] font-medium text-slate-600">
                                                                                {new Date(ticket.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                                                            </td>
                                                                            <td className="p-4 text-[11px] font-bold text-slate-800">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.equipmentCost)}
                                                                            </td>
                                                                            <td className="p-4 text-[11px] font-bold text-slate-800">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.overheadCost)}
                                                                            </td>
                                                                            <td className="p-4 text-[11px] font-black text-slate-900">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.totalCost)}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan={4} className="p-20 text-center">
                                                                            <div className="flex flex-col items-center gap-2">
                                                                                <Search size={40} className="text-slate-200" />
                                                                                <span className="text-slate-400 text-xs font-bold">No daily job tickets found for this project.</span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {!['Transactions', 'Summary', 'Daily Job Tickets'].includes(activeDetailTab) && (
                                                <div className="p-24 text-center space-y-6 animate-fade-in">
                                                    <div className="p-6 bg-slate-50 inline-block rounded-full shadow-inner">
                                                        <Clock className="w-16 h-16 text-slate-300" />
                                                    </div>
                                                    <div className="max-w-md mx-auto">
                                                        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">{activeDetailTab}</h3>
                                                        <p className="text-slate-500 font-medium text-sm leading-relaxed">
                                                            We're currently working on integrating the real-time data for this section from QuickBooks. 
                                                            Check back soon for updates!
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col min-h-0">

                                        {/* Table Layout */}
                                        <div className="flex-1 min-h-0 mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                            <div className="flex-1 overflow-y-auto">
                                                <table className="w-full text-left border-collapse border border-slate-200">
                                                    <thead className="sticky top-0 z-10 bg-white">
                                                        <tr className="bg-slate-50/50">
                                                            <th className="p-1.5 w-6 border border-slate-200"></th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('project') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Project</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('proposal-num') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Proposal #</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals estimate#</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('date') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Date</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('writers') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Proposal Writers</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals proposal writer</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight border border-slate-200 transition-colors ${activeHighlight.includes('client') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-left">Client</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-contract') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Original Contract</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals amount (latest version)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('change-orders') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Orders</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by our proposals change orders (sum of all change orders if status is completed or won)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('updated-contract') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger 
                                                                        className="w-full text-right"
                                                                        onMouseEnter={() => setActiveHighlight(['orig-contract', 'change-orders'])}
                                                                        onMouseLeave={() => setActiveHighlight([])}
                                                                    >Original Contract Cost</TooltipTrigger>
                                                                    <TooltipContent side="top">Original Contract + Change Orders</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('co-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Order Cost</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('total-cost') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('orig-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Original Contract GP</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('co-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Change Order GP</TooltipTrigger>
                                                                    <TooltipContent side="top">(will update soon)</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('est-gp') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-800 uppercase tracking-tight text-right border border-slate-200 bg-[#D8E983] transition-colors ${activeHighlight.includes('revenue') ? 'bg-[#c1d35a]' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-right">Revenue Earned to Date</TooltipTrigger>
                                                                    <TooltipContent side="top">Reference by QuickBooks Record</TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('cost-revenue') ? 'bg-blue-100/50 text-blue-700' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-right border border-slate-200 transition-colors ${activeHighlight.includes('gp-loss') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('gp-pct') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('markup') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('complete') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                            <th className={`p-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('sync') ? 'bg-blue-100 text-blue-800' : ''}`}>
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
                                                        ) : paginatedProjects.length > 0 ? (
                                                            paginatedProjects.map((project) => {
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
                                                                const cellBase = "p-1 text-[9px] whitespace-nowrap border border-slate-200 transition-colors";
                                                                const cellCls = `${cellBase} text-slate-800`;
                                                                const highlightCls = "bg-blue-100/30 font-bold text-blue-900";

                                                                return (
                                                                    <tr 
                                                                        key={project.Id} 
                                                                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                                        onClick={() => setSelectedProject(project)}
                                                                    >
                                                                        <td className="p-1.5 text-center text-[9px] border border-slate-200">
                                                                            <button 
                                                                                className={`${project.isFavorite ? 'text-amber-400' : 'text-slate-300'} hover:text-amber-400 transition-colors`}
                                                                                onClick={(e) => { e.stopPropagation(); }}
                                                                            >
                                                                                <Star size={10} fill={project.isFavorite ? 'currentColor' : 'none'} />
                                                                            </button>
                                                                        </td>
                                                                        <td className={`${cellCls} min-w-[120px] max-w-[150px] ${activeHighlight.includes('project') ? highlightCls : ''}`}>
                                                                            <div className="truncate text-[9px]" title={project.DisplayName}>{project.DisplayName}</div>
                                                                        </td>
                                                                        <td className={`${cellCls} ${activeHighlight.includes('proposal-num') ? highlightCls : ''}`}>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {editingProposalId === project.Id ? (
                                                                                    <input 
                                                                                        type="text"
                                                                                        value={editingProposalValue}
                                                                                        onChange={(e) => setEditingProposalValue(e.target.value)}
                                                                                        className="w-16 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[7px] outline-none shadow-sm"
                                                                                        autoFocus
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveProposal(project.Id);
                                                                                            if (e.key === 'Escape') setEditingProposalId(null);
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <div 
                                                                                        className="cursor-pointer hover:underline text-[9px]"
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
                                                                                        <ExternalLink size={8} />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className={`${cellCls} ${activeHighlight.includes('date') ? highlightCls : ''}`}>{project.startDate}</td>
                                                                        <td className={`${cellCls} ${activeHighlight.includes('writers') ? highlightCls : ''}`}>
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
                                                                                                <div className="w-5 h-5 rounded-full bg-[#0F4C75] border-2 border-white flex items-center justify-center text-[7px] text-white font-black shadow-sm overflow-hidden cursor-help">
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
                                                                                            <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[7px] text-slate-600 font-bold shadow-sm cursor-help">
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
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('orig-contract') ? highlightCls : ''}`}>{fmt(originalContract)}</td>
                                                                        <td className={`${cellCls} text-right ${activeHighlight.includes('change-orders') ? highlightCls : ''}`}>{fmt(changeOrders)}</td>
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
                                                                        <td className={`p-1.5 text-center border border-slate-200 transition-colors ${activeHighlight.includes('sync') ? highlightCls : ''}`}>
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
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Table Pagination Footer */}
                                            {filteredProjects.length > 0 && (
                                                <div className="py-2 px-4 border-t border-slate-50 flex items-center justify-between bg-white">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredProjects.length)}</span> of <span className="text-slate-900">{filteredProjects.length}</span> projects
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(prev - 1, 1)); }}
                                                            disabled={currentPage === 1}
                                                            className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                                        >
                                                            Previous
                                                        </button>
                                                        <div className="flex items-center gap-1">
                                                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                                                let pageNum = i + 1;
                                                                if (totalPages > 5 && currentPage > 3) {
                                                                    pageNum = currentPage - 3 + i + 1;
                                                                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                                                }
                                                                if (pageNum <= 0) return null;
                                                                if (pageNum > totalPages) return null;

                                                                return (
                                                                    <button
                                                                        key={pageNum}
                                                                        onClick={(e) => { e.stopPropagation(); setCurrentPage(pageNum); }}
                                                                        className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all ${
                                                                            currentPage === pageNum 
                                                                            ? 'bg-[#0F4C75] text-white shadow-md' 
                                                                            : 'text-slate-500 hover:bg-slate-50'
                                                                        }`}
                                                                    >
                                                                        {pageNum}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(prev + 1, totalPages)); }}
                                                            disabled={currentPage === totalPages}
                                                            className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
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

