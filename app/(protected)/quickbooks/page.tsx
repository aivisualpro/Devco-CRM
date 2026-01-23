
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/ui/Header';
import { BadgeTabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { DollarSign, LayoutDashboard, Briefcase, RefreshCw, ExternalLink, Calendar, User, Search, Filter, Star, MoreVertical, Settings, Printer, Share2, ChevronDown, Clock, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
    income?: number;
    cost?: number;
    profitMargin?: number;
    timeSpent?: string;
    startDate?: string;
    endDate?: string;
    isFavorite?: boolean;
}

export default function QuickBooksPage() {
    const [activeTab, setActiveTab] = useState('projects');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState('Summary');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [loadingProfitability, setLoadingProfitability] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [projectStatusFilter, setProjectStatusFilter] = useState('In progress');
    const [customerFilter, setCustomerFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('All');
    const [dateRangeFilter, setDateRangeFilter] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('qb_date_range_filter') || 'this_year';
        }
        return 'this_year';
    });

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'projects', label: 'Projects' },
    ];

    const detailTabs = ['Summary', 'Transactions', 'Time Activity', 'Project Reports', 'Project Details', 'Change Log', 'Attachments'];

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
                    cost: data.cost,
                    profitMargin: data.profitMargin
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
                    const updatedProject = projectData.find((p: any) => p.projectId === projectId);
                    if (updatedProject) {
                        setProjects(prev => prev.map(p => p.Id === projectId ? {
                            ...p,
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

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchProjectTransactions(selectedProject.Id);
            fetchProjectProfitability(selectedProject.Id);
        } else {
            setTransactions([]);
        }
    }, [selectedProject?.Id]);

    // Persist date range filter to localStorage
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
        const matchesSearch = project.DisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             project.FullyQualifiedName.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCustomer = !customerFilter || (project.CompanyName && project.CompanyName.toLowerCase().includes(customerFilter.toLowerCase()));
        
        // Apply date range filter based on project creation date
        const matchesDateRange = isWithinDateRange(project.MetaData?.CreateTime);
        
        return matchesSearch && matchesCustomer && matchesDateRange;
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

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Header showDashboardActions={true} />
            
            <main className="flex-1 flex flex-col min-h-0 p-4 bg-[#f8fafc]">
                <div className="flex-1 flex flex-col min-h-0 space-y-6">
                    {/* Project Detail Header */}
                    {selectedProject && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedProject(null)}
                                        className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                                    >
                                        <ChevronDown className="w-5 h-5 rotate-90" />
                                    </button>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-emerald-600" />
                                            <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                                {selectedProject.DisplayName}
                                            </h1>
                                        </div>
                                        <div className="h-6 w-[1px] bg-slate-200"></div>
                                        <div className="flex items-center gap-1 cursor-pointer group">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">In progress</span>
                                            <ChevronDown className="w-3.5 h-3.5 text-emerald-600 transition-transform group-hover:translate-y-0.5" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 pl-12">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                        Project ID: {selectedProject.Id}
                                    </p>
                                    <Star className="w-3.5 h-3.5 text-slate-300 cursor-pointer hover:text-amber-400 transition-colors" />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button className="px-4 py-1.5 border border-slate-300 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                                    Edit
                                </button>
                                <div className="flex items-center">
                                    <button className="px-4 py-1.5 bg-[#2CA01C] border border-[#2CA01C] rounded-l-md text-xs font-bold text-white hover:bg-[#248216] transition-colors shadow-sm">
                                        Add to project
                                    </button>
                                    <button className="px-2 py-1.5 bg-[#2CA01C] border-l border-white/20 rounded-r-md text-white hover:bg-[#248216] transition-colors shadow-sm">
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="space-y-6">
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Navigation & Sync row for Overview */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm">
                                                    <Filter className="w-3.5 h-3.5" />
                                                    Filters
                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-6 space-y-6" align="start">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">View</label>
                                                        <div className="relative group">
                                                            <select 
                                                                value={activeTab}
                                                                onChange={(e) => setActiveTab(e.target.value)}
                                                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer"
                                                            >
                                                                <option value="overview">Overview</option>
                                                                <option value="projects">Projects</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
                                                        <div className="relative group">
                                                            <select 
                                                                value={dateRangeFilter}
                                                                onChange={(e) => setDateRangeFilter(e.target.value)}
                                                                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer"
                                                            >
                                                                <option value="all">All Time</option>
                                                                <option value="this_month">This Month</option>
                                                                <option value="this_year">This Year</option>
                                                                <option value="last_year">Last Year</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <div className="h-10 w-[1px] bg-slate-100 hidden md:block"></div>

                                        <div className="hidden md:flex items-center gap-8">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Income</span>
                                                <span className="text-sm font-black text-emerald-600">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Cost</span>
                                                <span className="text-sm font-black text-amber-600">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Profit</span>
                                                <span className="text-sm font-black text-[#0F4C75]">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalProfit)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => fetchProjects(true)}
                                        disabled={refreshing || loading}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                        Sync Data
                                    </button>
                                </div>

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

                        {activeTab === 'projects' && (
                            <div className="space-y-4 animate-fade-in">
                                {selectedProject ? (
                                    /* Project Detail View */
                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                        {/* Detail Tabs */}
                                        <div className="flex items-center px-6 border-b border-slate-100 overflow-x-auto">
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
                                            <button className="text-sm font-bold text-[#0F4C75] hover:underline">Take a tour</button>
                                        </div>

                                        {/* Tab Content Rendering */}
                                        <div className="flex-1">
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
                                                                    <tr>
                                                                        <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                                                                            <div className="flex flex-col items-center gap-2">
                                                                                <Rocket className="w-6 h-6 animate-bounce text-[#0F4C75]" style={{ animationDuration: '0.5s' }} />
                                                                                Loading transactions...
                                                                            </div>
                                                                        </td>
                                                                    </tr>
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
                                                <div className="p-4 space-y-10 animate-fade-in max-w-6xl">
                                                    {/* Filter Section */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">See info based on</label>
                                                        <div className="relative group max-w-[240px]">
                                                            <select className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer shadow-sm">
                                                                <option>Payroll Expenses</option>
                                                                <option>Total Expenses</option>
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    {/* Project Balance Summary Section */}
                                                    <div className="space-y-6">
                                                        <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Project balance summary</h2>
                                                        
                                                        <div className="flex flex-col lg:flex-row items-center gap-4">
                                                            {/* Income Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-300">
                                                                        <Rocket className="w-5 h-5 text-[#0F4C75] animate-bounce" style={{ animationDuration: '0.5s' }} />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INCOME</span>
                                                                    <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.income || 0)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[10px] font-black tracking-tighter">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-400 uppercase mb-0.5">Actual</span>
                                                                        <span className="text-slate-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.income || 0)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-slate-400 uppercase mb-0.5">Estimated</span>
                                                                        <span className="text-slate-500">$0.00</span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-emerald-500 rounded-full w-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                                                                </div>
                                                                <button className="text-[10px] font-black text-[#0F4C75] hover:underline uppercase tracking-widest">View details</button>
                                                            </Card>

                                                            {/* Operator - */}
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 font-bold shrink-0 shadow-inner">
                                                                <span className="text-xl">−</span>
                                                            </div>

                                                            {/* Costs Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-300">
                                                                        <Rocket className="w-5 h-5 text-[#0F4C75] animate-bounce" style={{ animationDuration: '0.5s' }} />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COSTS</span>
                                                                    <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.cost || 0)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[10px] font-black tracking-tighter">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-400 uppercase mb-0.5">Actual</span>
                                                                        <span className="text-slate-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedProject.cost || 0)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-slate-400 uppercase mb-0.5">Estimated</span>
                                                                        <span className="text-slate-500">$0.00</span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                                                                        style={{ width: `${((selectedProject.cost || 0) / (selectedProject.income || 1)) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <button className="text-[10px] font-black text-[#0F4C75] hover:underline uppercase tracking-widest">View details</button>
                                                            </Card>

                                                            {/* Operator = */}
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 font-bold shrink-0 shadow-inner">
                                                                <span className="text-xl">=</span>
                                                            </div>

                                                            {/* Profit Card */}
                                                            <Card className="flex-1 w-full p-6 space-y-5 border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                                {loadingProfitability && (
                                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-300">
                                                                        <Rocket className="w-5 h-5 text-[#0F4C75] animate-bounce" style={{ animationDuration: '0.5s' }} />
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PROFIT</span>
                                                                    <div className="text-3xl font-black text-slate-[#0F4C75] tracking-tighter">
                                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((selectedProject.income || 0) - (selectedProject.cost || 0))}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1 text-[10px] font-black tracking-tighter">
                                                                    <span className="text-slate-400 uppercase block">Actual profit margin</span>
                                                                    <span className="text-slate-900 text-lg">{selectedProject.profitMargin}%</span>
                                                                </div>
                                                                <div className="pt-2"></div>
                                                            </Card>
                                                        </div>
                                                    </div>

                                                    {/* Invoices Section */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                                                        <Card className="p-6 space-y-4 border-slate-100 shadow-sm hover:border-emerald-100 transition-colors">
                                                            <div className="space-y-1">
                                                                <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(openInvoicesTotal)}
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open invoices</span>
                                                            </div>
                                                            <button className="text-[10px] font-black text-[#0F4C75] hover:underline uppercase tracking-widest">View all</button>
                                                        </Card>

                                                        <Card className="p-6 space-y-4 border-slate-100 shadow-sm hover:border-amber-100 transition-colors">
                                                            <div className="space-y-1">
                                                                <div className="text-3xl font-black text-slate-800 tracking-tighter">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overdueInvoicesTotal)}
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue invoices</span>
                                                            </div>
                                                            <button className="text-[10px] font-black text-[#0F4C75] hover:underline uppercase tracking-widest">View all</button>
                                                        </Card>
                                                    </div>
                                                </div>
                                            )}

                                            {!['Transactions', 'Summary'].includes(activeDetailTab) && (
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
                                        {/* Filters Header */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-6">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm">
                                                            <Filter className="w-3.5 h-3.5" />
                                                            Filters
                                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-6 space-y-6" align="start">
                                                        <div className="space-y-4">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">View</label>
                                                                <div className="relative group">
                                                                    <select 
                                                                        value={activeTab}
                                                                        onChange={(e) => setActiveTab(e.target.value)}
                                                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer"
                                                                    >
                                                                        <option value="overview">Overview</option>
                                                                        <option value="projects">Projects</option>
                                                                    </select>
                                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                                                <div className="relative group">
                                                                    <select 
                                                                        value={projectStatusFilter}
                                                                        onChange={(e) => setProjectStatusFilter(e.target.value)}
                                                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer"
                                                                    >
                                                                        <option>All statuses</option>
                                                                        <option>In progress</option>
                                                                        <option>Completed</option>
                                                                        <option>Cancelled</option>
                                                                    </select>
                                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</label>
                                                                <input 
                                                                    placeholder="Search customer" 
                                                                    value={customerFilter}
                                                                    onChange={(e) => setCustomerFilter(e.target.value)}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75]" 
                                                                />
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Based on</label>
                                                                <div className="relative group">
                                                                    <select className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer">
                                                                        <option>Payroll Expenses</option>
                                                                        <option>Total Expenses</option>
                                                                    </select>
                                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
                                                                <div className="relative group">
                                                                    <select 
                                                                        value={dateRangeFilter}
                                                                        onChange={(e) => setDateRangeFilter(e.target.value)}
                                                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer"
                                                                    >
                                                                        <option value="all">All Time</option>
                                                                        <option value="this_month">This Month</option>
                                                                        <option value="this_year">This Year</option>
                                                                        <option value="last_year">Last Year</option>
                                                                    </select>
                                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search</label>
                                                                <div className="relative group">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="Project name..." 
                                                                        value={searchQuery}
                                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75]" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>

                                                <div className="h-10 w-[1px] bg-slate-100 hidden md:block"></div>

                                                <div className="hidden md:flex items-center gap-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Income</span>
                                                        <span className="text-sm font-black text-emerald-600">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Cost</span>
                                                        <span className="text-sm font-black text-amber-600">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Profit</span>
                                                        <span className="text-sm font-black text-[#0F4C75]">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalProfit)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => fetchProjects(true)}
                                                disabled={refreshing || loading}
                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                                Sync Data
                                            </button>
                                        </div>

                                        {/* Table Layout */}
                                        <div className="flex-1 min-h-0 mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                            <div className="flex-1 overflow-y-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                                            <th className="p-3 w-8"></th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Project</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Income vs. Cost</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Profit</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Time</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Start Date</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">End Date</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
                                                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Sync</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {loading ? (
                                                            <tr>
                                                                <td colSpan={10} className="p-12 text-center">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <Rocket className="w-8 h-8 text-[#0F4C75] animate-bounce" style={{ animationDuration: '0.5s' }} />
                                                                        <span className="text-slate-400 font-bold">Loading your projects...</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : filteredProjects.length > 0 ? (
                                                            filteredProjects.map((project) => (
                                                                <tr 
                                                                    key={project.Id} 
                                                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                                    onClick={() => setSelectedProject(project)}
                                                                >
                                                                    <td className="p-3 text-center">
                                                                        <button 
                                                                            className={`${project.isFavorite ? 'text-amber-400' : 'text-slate-300'} hover:text-amber-400 transition-colors`}
                                                                            onClick={(e) => { e.stopPropagation(); /* Favorite logic */ }}
                                                                        >
                                                                            <Star size={14} fill={project.isFavorite ? 'currentColor' : 'none'} />
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-3 min-w-[250px]">
                                                                        <div className="text-[11px] font-bold text-slate-700 group-hover:text-[#0F4C75] transition-colors line-clamp-1">{project.DisplayName}</div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="text-[11px] font-medium text-slate-500 line-clamp-1">{project.CompanyName || project.FullyQualifiedName.split(':')[0] || '---'}</div>
                                                                    </td>
                                                                    <td className="p-3 min-w-[220px]">
                                                                        <div className="space-y-2">
                                                                            {/* Income Bar */}
                                                                            <div className="flex items-center gap-3">
                                                                                 <span className="text-[10px] font-medium text-slate-500 w-10">Income</span>
                                                                                 <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                                                                                     <div className="h-full bg-[#65C466] rounded-sm" style={{ width: '100%' }}></div> 
                                                                                 </div>
                                                                                 <span className="text-[11px] font-medium text-slate-700 w-20 text-right">
                                                                                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.income || 0)}
                                                                                 </span>
                                                                            </div>
                                                                            {/* Cost Bar */}
                                                                            <div className="flex items-center gap-3">
                                                                                 <span className="text-[10px] font-medium text-slate-500 w-10">Costs</span>
                                                                                 <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                                                                                     <div 
                                                                                         className="h-full bg-[#007da0] rounded-sm" 
                                                                                         style={{ width: `${project.income ? Math.min(((project.cost || 0) / project.income) * 100, 100) : 0}%` }}
                                                                                     ></div>
                                                                                 </div>
                                                                                 <span className="text-[11px] font-medium text-slate-700 w-20 text-right">
                                                                                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.cost || 0)}
                                                                                 </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="text-[12px] font-medium text-slate-600">{project.profitMargin}%</div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                                            <Clock size={12} />
                                                                            {project.timeSpent}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="text-[10px] font-bold text-slate-500">{project.startDate}</div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="text-[10px] font-bold text-slate-500">{project.endDate}</div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-100 text-emerald-800 uppercase tracking-tighter">
                                                                            In progress
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                syncIndividualProject(project.Id);
                                                                            }}
                                                                            disabled={syncingProjectId === project.Id}
                                                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#0F4C75] transition-all disabled:opacity-50"
                                                                            title="Sync this project"
                                                                        >
                                                                            <RefreshCw className={`w-3.5 h-3.5 ${syncingProjectId === project.Id ? 'animate-spin' : ''}`} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={10} className="p-20 text-center">
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
                                        </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
        </div>
    );
}

