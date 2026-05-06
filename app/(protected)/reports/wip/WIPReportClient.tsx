
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Header from '@/components/ui/Header';
import { BadgeTabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { 
    DollarSign, LayoutDashboard, Briefcase, RefreshCw, ExternalLink, 
    Calendar, User, Users, Search, Filter, Star, MoreVertical, 
    Settings, Printer, Share2, ChevronDown, Clock, Rocket, X,
    FileText, Target, TrendingUp, Zap, HelpCircle, PieChart as PieChartIcon, Info, ArrowLeft, FolderOpen,
    CalendarClock, Shield, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Skeleton, SkeletonTableRow, SkeletonTable, Modal } from '@/components/ui';

import { DJTModal } from '../../jobs/schedules/components/DJTModal';
import { ScheduleCard } from '../../jobs/schedules/components/ScheduleCard';
import { ScheduleDetailsPopup } from '@/components/ui/ScheduleDetailsPopup';
import { JHACard } from '../../docs/jha/components/JHACard';
import { JHAModal } from '../../jobs/schedules/components/JHAModal';
import { formatDateOnly, calculateTimesheetData } from '@/lib/timeCardUtils';
import { getLocalNowISO } from '@/lib/scheduleUtils';
import { formatWallDate } from '@/lib/format/date';
import { FinancialsView } from './_components/FinancialsView';
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
    ar?: number;
    ap?: number;
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
    const [isExportingPdf, setIsExportingPdf] = useState(false);
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

    // Schedules & JHAs Card State
    const [projectSchedules, setProjectSchedules] = useState<any[]>([]);
    const [projectJHAs, setProjectJHAs] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [loadingJHAs, setLoadingJHAs] = useState(false);
    const [schedulesPopupOpen, setSchedulesPopupOpen] = useState(false);
    const [jhasPopupOpen, setJhasPopupOpen] = useState(false);
    const [ticketsPopupOpen, setTicketsPopupOpen] = useState(false);
    const [hoursPopupOpen, setHoursPopupOpen] = useState(false);
    
    // Schedule detail popup state (for clicking on a schedule card)
    const [selectedScheduleForDetail, setSelectedScheduleForDetail] = useState<any>(null);
    const [scheduleDetailPopupOpen, setScheduleDetailPopupOpen] = useState(false);
    
    // JHA modal state for viewing JHAs from WIP
    const [wipJhaModalOpen, setWipJhaModalOpen] = useState(false);
    const [selectedWipJHA, setSelectedWipJHA] = useState<any>(null);
    const [isWipJhaEditMode, setIsWipJhaEditMode] = useState(false);
    const [wipJhaSignatureEmployee, setWipJhaSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingWipJHAPDF, setIsGeneratingWipJHAPDF] = useState(false);
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const tabs = [
        { id: 'financials', label: 'Financials' },
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

    const fetchProjectTransactions = async (projectId: string, refresh = false) => {
        setLoadingTransactions(true);
        try {
            const url = `/api/quickbooks/projects/${projectId}/transactions${refresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
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
                            income: updatedProject.income || 0,
                            cost: updatedProject.cost || 0,
                            profitMargin: updatedProject.profitMargin || 0
                        } : p));
                    }
                }
                // Force-refresh transactions from live QB (sync already updated MongoDB)
                fetchProjectTransactions(projectId, true);
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

        if (mainTab && ['financials', 'wip'].includes(mainTab)) {
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

    // Track selectedProject in a ref so the Pusher callback always has the latest value
    const selectedProjectRef = useRef(selectedProject);
    useEffect(() => { selectedProjectRef.current = selectedProject; }, [selectedProject]);

    useEffect(() => {
        // Real-time QuickBooks sync listener via Pusher
        let channel: any = null;
        const setupPusher = async () => {
            try {
                const { getPusherClient } = await import('@/lib/realtime/pusher-client');
                const pusher = getPusherClient();
                if (!pusher) return;

                channel = pusher.subscribe('qbo-updates');
                channel.bind('projects-synced', (data: { projectIds: string[], projectNames: string[], changeTypes: string[], timestamp: string }) => {
                    console.log('[WIP] Live QB update received:', data);

                    // Show toast
                    const name = data.projectNames?.[0] || 'A project';
                    const types = data.changeTypes?.join(', ') || 'Transaction';
                    toast.success(`QB Sync: ${types} updated in ${name}`, { duration: 5000, icon: '🔄' });

                    // Re-fetch the WIP project list (bypass server cache)
                    fetch('/api/quickbooks/projects?refresh=true')
                        .then(r => r.json())
                        .then(freshData => {
                            if (!freshData.error) {
                                const enhanced = freshData.map((p: any) => ({
                                    ...p,
                                    income: p.income || 0,
                                    cost: p.cost || 0,
                                    profitMargin: p.profitMargin || 0,
                                    timeSpent: '0:00',
                                    startDate: formatDateOnly(p.MetaData.CreateTime),
                                    endDate: formatDateOnly(new Date(new Date(p.MetaData.CreateTime).getTime() + 86400000 * 30).toISOString()),
                                    isFavorite: false
                                })).sort((a: any, b: any) => {
                                    const aNum = a.proposalNumber || '';
                                    const bNum = b.proposalNumber || '';
                                    if (!aNum && !bNum) return 0;
                                    if (!aNum) return 1;
                                    if (!bNum) return -1;
                                    return bNum.localeCompare(aNum, undefined, { numeric: true });
                                });
                                setProjects(enhanced);
                            }
                        }).catch(() => {});

                    // If currently viewing a synced project, refresh its transactions too
                    const current = selectedProjectRef.current;
                    if (current && data.projectIds.includes(current.Id)) {
                        fetchProjectTransactions(current.Id, true);
                    }
                });
            } catch (err) {
                console.warn('[WIP] Pusher setup failed:', err);
            }
        };
        setupPusher();

        return () => {
            if (channel) {
                channel.unbind_all();
                channel.unsubscribe();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Fetch Schedules count for the project
    const fetchProjectSchedules = useCallback(async (proposalNumber: string) => {
        if (!proposalNumber) { setProjectSchedules([]); return; }
        setLoadingSchedules(true);
        try {
            const baseEstimate = proposalNumber.includes('-') ? proposalNumber.split('-').slice(0, 2).join('-') : proposalNumber;
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedulesByEstimate', payload: { estimateNumber: baseEstimate } })
            });
            const data = await res.json();
            if (data.success) {
                setProjectSchedules(data.result || []);
            }
        } catch (e) {
            console.error('Error fetching schedules:', e);
        } finally {
            setLoadingSchedules(false);
        }
    }, []);

    // Fetch JHAs count for the project
    const fetchProjectJHAs = useCallback(async (proposalNumber: string) => {
        if (!proposalNumber) { setProjectJHAs([]); return; }
        setLoadingJHAs(true);
        try {
            const baseEstimate = proposalNumber.includes('-') ? proposalNumber.split('-').slice(0, 2).join('-') : proposalNumber;
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getJHAs', payload: { search: baseEstimate, page: 1, limit: 200 } })
            });
            const data = await res.json();
            if (data.success) {
                setProjectJHAs(data.result?.jhas || []);
            }
        } catch (e) {
            console.error('Error fetching JHAs:', e);
        } finally {
            setLoadingJHAs(false);
        }
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchProjectTransactions(selectedProject.Id);
            fetchProjectProfitability(selectedProject.Id);
            // Fetch schedules and JHAs counts
            if (selectedProject.proposalNumber) {
                fetchProjectSchedules(selectedProject.proposalNumber);
                fetchProjectJHAs(selectedProject.proposalNumber);
            }
        } else {
            setTransactions([]);
            setProjectSchedules([]);
            setProjectJHAs([]);
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
                    'A/R': fmt(project.ar || 0),
                    'A/P': fmt(project.ap || 0),
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

    const handleExportPdf = useCallback(async () => {
        setIsExportingPdf(true);
        try {
            // Import the insight logic dynamically to avoid circular deps
            const { computeInsights } = await import('./_components/computeInsights');
            const { DEFAULT_THRESHOLDS } = await import('@/lib/constants/financialThresholds');

            // Re-compute KPIs from the current projects list (same as FinancialsView logic)
            const allProjects = projects; // full list — FinancialsView has its own filter; we export everything
            const sum = (key: string) => allProjects.reduce((s: number, p: any) => s + (Number((p as any)[key]) || 0), 0);
            const income = sum('income');
            const qbCost = sum('qbCost');
            const jobTicketCost = sum('devcoCost');
            const originalContract = sum('originalContract');
            const changeOrders = sum('changeOrders');
            const totalCost = qbCost + jobTicketCost;
            const profit = income - totalCost;
            const marginPct = income > 0 ? (profit / income) * 100 : 0;
            const arOutstanding = sum('ar');
            const paymentsReceived = income - arOutstanding;
            const collectedPct = income > 0 ? (paymentsReceived / income) * 100 : 0;
            const payables = sum('ap');
            const contractValue = originalContract + changeOrders;
            const backlog = Math.max(0, contractValue - income);
            const pctComplete = contractValue > 0 ? Math.min(100, (income / contractValue) * 100) : 0;
            const avgProjectSize = allProjects.length > 0 ? contractValue / allProjects.length : 0;
            const eac = pctComplete > 0 ? totalCost / (pctComplete / 100) : 0;
            const overUnderBilling = income - contractValue * (pctComplete / 100);
            const dso = income > 0 ? Math.round((arOutstanding / income) * 365) : 0;

            const kpis = {
                income, qbCost, jobTicketCost, totalCost, originalContract, changeOrders,
                profit, marginPct, projectCount: allProjects.length, arOutstanding,
                paymentsReceived, collectedPct, payables, contractValue, backlog, pctComplete,
                avgProjectSize, eac, overUnderBilling, dso, periodDays: 365,
            };

            const insights = computeInsights(allProjects as any, DEFAULT_THRESHOLDS);

            const top10 = [...allProjects]
                .map((p: any) => {
                    const inc = p.income || 0;
                    const cost = (p.qbCost || 0) + (p.devcoCost || 0);
                    const calcProfit = inc - cost;
                    const calcMargin = inc > 0 ? (calcProfit / inc) * 100 : 0;
                    return { ...p, calcIncome: inc, calcCost: cost, calcProfit, calcMargin, calcAR: p.ar || 0, calcPctComplete: 0 };
                })
                .sort((a: any, b: any) => b.calcProfit - a.calcProfit)
                .slice(0, 10);

            const response = await fetch('/api/reports/financials/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kpis,
                    insights,
                    projects: allProjects,
                    top10,
                    periodLabel: 'All Time',
                    projectCount: allProjects.length,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'PDF generation failed' }));
                throw new Error(err.error || 'PDF generation failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DEVCO-Financials-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Financial report PDF downloaded!');
        } catch (error: any) {
            console.error('PDF export error:', error);
            toast.error(error?.message || 'Failed to generate PDF report');
        } finally {
            setIsExportingPdf(false);
        }
    }, [projects]);

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
                    isRefreshing: refreshing,
                    onExportPdf: handleExportPdf,
                    isExportingPdf,
                } : undefined}
            />
            
            <main className={`flex-1 flex flex-col min-h-0 ${!selectedProject && activeTab !== 'financials' ? 'p-4' : ''} bg-[#f8fafc]`}>
                <div className={`flex-1 flex flex-col min-h-0 ${!selectedProject && activeTab !== 'financials' ? 'space-y-6' : ''}`}>
                    {/* Project Detail Header removed per user request */}

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {activeTab === 'financials' && (
                            <FinancialsView
                                projects={projects}
                                loading={loading}
                                onExportPdf={handleExportPdf}
                                isExportingPdf={isExportingPdf}
                            />
                        )}

                        {activeTab === 'wip' && (
                            <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fade-in">
                                {selectedProject ? (
                                    /* Project Detail View (Page Mode) */
                                    <div className="bg-white rounded-none shadow-sm overflow-hidden flex flex-col h-full lg:h-full animate-in slide-in-from-right-8 duration-300">
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
                                                    onClick={() => syncIndividualProject(selectedProject.Id)}
                                                    disabled={loadingTransactions || syncingProjectId === selectedProject.Id}
                                                    title="Pull latest transactions from QuickBooks"
                                                    className="flex xl:hidden items-center justify-center gap-2 px-3 py-2 bg-[#0F4C75] hover:bg-[#3282B8] text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed h-10 shrink-0"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${syncingProjectId === selectedProject.Id ? 'animate-spin' : ''}`} />
                                                    <span className="text-[11px]">Sync QB</span>
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
                                                    onClick={() => syncIndividualProject(selectedProject.Id)}
                                                    disabled={loadingTransactions || syncingProjectId === selectedProject.Id}
                                                    title="Pull latest transactions from QuickBooks"
                                                    className="flex items-center justify-center gap-2 px-5 py-2 bg-[#0F4C75] hover:bg-[#3282B8] text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed h-14 shrink-0"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${syncingProjectId === selectedProject.Id ? 'animate-spin' : ''}`} />
                                                    <span className="text-sm">Sync QB</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-0 p-4 bg-slate-50/50 overflow-y-auto lg:overflow-visible">
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

                                            {/* Schedules, JHAs, Tickets & Hours Cards Row */}
                                            {(() => {
                                                const schedCount = projectSchedules.length;
                                                const jhaCount = projectJHAs.length;
                                                const ticketCount = (selectedProject.jobTickets || []).length;
                                                const jhaPct = schedCount > 0 ? Math.round((jhaCount / schedCount) * 100) : 0;
                                                const ticketPct = schedCount > 0 ? Math.round((ticketCount / schedCount) * 100) : 0;

                                                // Hours calculation from timesheet arrays
                                                // Falls back to calculateTimesheetData() when ts.hours is not pre-stored
                                                let siteHrs = 0;
                                                let driveHrs = 0;
                                                for (const sched of projectSchedules) {
                                                    const schedDate = sched.fromDate ? new Date(sched.fromDate).toISOString().split('T')[0] : undefined;
                                                    for (const ts of (sched.timesheet || [])) {
                                                        const storedH = typeof ts.hours === 'number' ? ts.hours : parseFloat(ts.hours || '') || 0;
                                                        const h = storedH > 0 ? storedH : (calculateTimesheetData(ts, schedDate).hours || 0);
                                                        const typeLower = (ts.type || '').toLowerCase();
                                                        if (typeLower.includes('drive')) {
                                                            driveHrs += h;
                                                        } else {
                                                            siteHrs += h;
                                                        }
                                                    }
                                                }
                                                const totalHrs = siteHrs + driveHrs;

                                                // Avg Cost/Hr calculation
                                                const laborCost = (transactions as any[]).reduce((sum: number, tx: any) => {
                                                    const isPayroll = (tx.type || '').toLowerCase() === 'payroll check';
                                                    const isUnion = (tx.from || '').toLowerCase().includes('southern california construction laborers');
                                                    if (isPayroll || isUnion) return sum + (Math.abs(tx.amount) || 0);
                                                    return sum;
                                                }, 0);
                                                const avgCostPerHr = totalHrs > 0 ? laborCost / totalHrs : 0;

                                                return (
                                            <div className="shrink-0 mb-3">
                                                <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-5 gap-2">
                                                    {/* Schedules Card */}
                                                    <div
                                                        onClick={() => setSchedulesPopupOpen(true)}
                                                        className="relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                                                    >
                                                        <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200" />
                                                        <div className="relative p-3 flex justify-between items-center h-full">
                                                            <div className="flex flex-col justify-center">
                                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                                    <CalendarClock className="w-3.5 h-3.5" />
                                                                    Schedules
                                                                </p>
                                                                {loadingSchedules ? (
                                                                    <Skeleton className="h-7 w-10 rounded-md" />
                                                                ) : (
                                                                    <p className="text-2xl font-black text-indigo-950 tracking-tight leading-none">{schedCount}</p>
                                                                )}
                                                            </div>
                                                            <div className="bg-indigo-100 group-hover:bg-indigo-200 rounded-lg p-2 transition-colors">
                                                                <CalendarClock className="w-5 h-5 text-indigo-500" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* JHAs Card */}
                                                    <div
                                                        onClick={() => {
                                                            if (selectedProject?.proposalNumber) {
                                                                fetchProjectJHAs(selectedProject.proposalNumber);
                                                            }
                                                            setJhasPopupOpen(true);
                                                        }}
                                                        className="relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                                                    >
                                                        <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200" />
                                                        <div className="relative p-3 flex justify-between items-center h-full">
                                                            <div className="flex flex-col justify-center">
                                                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                                    <Shield className="w-3.5 h-3.5" />
                                                                    JHAs
                                                                </p>
                                                                {loadingJHAs ? (
                                                                    <Skeleton className="h-7 w-10 rounded-md" />
                                                                ) : (
                                                                    <div className="flex items-end gap-2">
                                                                        <p className="text-2xl font-black text-orange-950 tracking-tight leading-none">{jhaCount}</p>
                                                                        {schedCount > 0 && (
                                                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none ${
                                                                                jhaPct >= 100 ? 'bg-emerald-100 text-emerald-700' : jhaPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                                                            }`}>{jhaPct}%</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="bg-orange-100 group-hover:bg-orange-200 rounded-lg p-2 transition-colors">
                                                                <Shield className="w-5 h-5 text-orange-500" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Tickets Card */}
                                                    <div
                                                        onClick={() => setTicketsPopupOpen(true)}
                                                        className="relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                                                    >
                                                        <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200" />
                                                        <div className="relative p-3 flex justify-between items-center h-full">
                                                            <div className="flex flex-col justify-center">
                                                                <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    Tickets
                                                                </p>
                                                                <div className="flex items-end gap-2">
                                                                    <p className="text-2xl font-black text-teal-950 tracking-tight leading-none">{ticketCount}</p>
                                                                    {schedCount > 0 && (
                                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none ${
                                                                            ticketPct >= 100 ? 'bg-emerald-100 text-emerald-700' : ticketPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                                                        }`}>{ticketPct}%</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="bg-teal-100 group-hover:bg-teal-200 rounded-lg p-2 transition-colors">
                                                                <FileText className="w-5 h-5 text-teal-500" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Hours Card */}
                                                    <div
                                                        onClick={() => setHoursPopupOpen(true)}
                                                        className="relative rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
                                                    >
                                                        <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200" />
                                                        <div className="relative p-3 flex justify-between items-start h-full">
                                                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    Hours
                                                                </p>
                                                                {loadingSchedules ? (
                                                                    <Skeleton className="h-7 w-20 rounded-md" />
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Site</span>
                                                                            <span className="text-xs font-black text-emerald-700 tabular-nums">{siteHrs.toFixed(1)}h</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Drive</span>
                                                                            <span className="text-xs font-black text-blue-700 tabular-nums">{driveHrs.toFixed(1)}h</span>
                                                                        </div>
                                                                        <div className="border-t border-purple-200 pt-1 flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-black text-purple-600 uppercase">Total</span>
                                                                            <span className="text-sm font-black text-purple-950 tabular-nums">{totalHrs.toFixed(1)}h</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="bg-purple-100 group-hover:bg-purple-200 rounded-lg p-2 transition-colors shrink-0 ml-2">
                                                                <Clock className="w-5 h-5 text-purple-500" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Avg Cost/Hr Card */}
                                                    <div
                                                        className="relative rounded-xl shadow-sm transition-all duration-200 group"
                                                    >
                                                        <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-zinc-50 border border-slate-300" />
                                                        <div className="relative p-3 flex justify-between items-start h-full">
                                                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                                    <DollarSign className="w-3.5 h-3.5" />
                                                                    Avg Cost/Hr
                                                                </p>
                                                                {loadingSchedules || loadingTransactions ? (
                                                                    <Skeleton className="h-7 w-20 rounded-md" />
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Labor</span>
                                                                            <span className="text-[10px] font-black text-slate-700 tabular-nums">${laborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Hours</span>
                                                                            <span className="text-[10px] font-black text-slate-700 tabular-nums">{totalHrs.toFixed(1)}h</span>
                                                                        </div>
                                                                        <div className="border-t border-slate-300 pt-1 flex items-center justify-between gap-2">
                                                                            <span className="text-[9px] font-black text-slate-600 uppercase">Rate</span>
                                                                            <span className={`text-sm font-black tabular-nums ${avgCostPerHr > 100 ? 'text-rose-700' : avgCostPerHr > 85 ? 'text-amber-700' : 'text-emerald-700'}`}>${avgCostPerHr.toFixed(2)}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="bg-slate-200 group-hover:bg-slate-300 rounded-lg p-2 transition-colors shrink-0 ml-2">
                                                                <DollarSign className="w-5 h-5 text-slate-500" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                                );
                                            })()}

                                            {/* 2 Boxes: Transactions & Daily Job Tickets */}
                                            <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-3 flex-1 min-h-[600px] lg:min-h-0 lg:overflow-hidden">
                                                {/* Transactions Box */}
                                                <Card className="flex flex-col min-h-[400px] lg:h-full border border-slate-200 shadow-none overflow-hidden bg-white">
                                                    <div className="px-3 h-12 border-b border-slate-100 bg-white shrink-0 flex items-center">
                                                        {/* Row 1: Title + Search + Filters + Counter */}
                                                        <div className="flex items-center gap-2 w-full">
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
                                                                const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
                                                                return (
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {hasFilter && (
                                                                            <span className="text-xs font-black text-[#0F4C75] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                                                                {fmt$(total)}
                                                                            </span>
                                                                        )}
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
                                                                <tr className="h-8">
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[10%] align-middle">Date</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[14%] align-middle">Type</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[8%] align-middle">No.</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[20%] align-middle">From/To</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[8%] align-middle">Status</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-[10%] align-middle">Amount</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[30%] align-middle">Memo</th>
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
                                                <Card className="flex flex-col min-h-[300px] lg:h-full border border-slate-200 shadow-none overflow-hidden bg-white">
                                                    <div className="px-3 h-12 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
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
                                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{(selectedProject.jobTickets || []).length} Records</span>
                                                    </div>
                                                    <div className="flex-1 overflow-auto bg-slate-50/30">
                                                        <table className="w-full text-left">
                                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 shadow-sm border-b border-slate-100">
                                                                <tr className="h-8">
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 align-middle">Date</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 align-middle">Equipment</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 align-middle">Overhead</th>
                                                                    <th className="px-2 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 text-right align-middle">Total Cost</th>
                                                                    <th className="px-2 py-0 w-auto align-middle"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {loadingProfitability ? (
                                                                    [...Array(5)].map((_, i) => (
                                                                        <tr key={i}>
                                                                            <td className="px-2 py-2"><div className="w-16 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-2 py-2"><div className="w-14 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-2 py-2"><div className="w-14 h-3 bg-slate-100 rounded animate-pulse" /></td>
                                                                            <td className="px-2 py-2 text-right"><div className="w-16 h-3 bg-slate-100 rounded animate-pulse ml-auto" /></td>
                                                                            <td></td>
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
                                                                            <td className="px-2 py-2 text-xs font-medium text-slate-600 group-hover:text-[#0F4C75]">{formatDateOnly(ticket.date)}</td>
                                                                            <td className="px-2 py-2 text-xs font-bold text-slate-700">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.equipmentCost)}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-xs font-bold text-slate-700">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.overheadCost)}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-xs font-black text-[#0F4C75] text-right">
                                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.totalCost)}
                                                                            </td>
                                                                            <td></td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-sm font-medium">No job tickets found.</td></tr>
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
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('ar') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-center">A/R</TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Accounts Receivable: Revenue Earned - Payments Received</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </th>
                                                            <th className={`px-2 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tight text-center border border-slate-200 transition-colors ${activeHighlight.includes('ap') ? 'bg-blue-100 text-blue-800' : ''}`}>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="w-full text-center">A/P</TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-[10px] font-bold">Accounts Payable: Open/Overdue Bills & Expenses</p>
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
                                                                <SkeletonTableRow key={i} columns={24} />
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
                                                                        <td className={`${cellCls} text-center ${activeHighlight.includes('ar') ? highlightCls : ''} ${(project.ar || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'}`}>{fmt(project.ar || 0)}</td>
                                                                        <td className={`${cellCls} text-center ${activeHighlight.includes('ap') ? highlightCls : ''} ${(project.ap || 0) > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>{fmt(project.ap || 0)}</td>
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

                {/* Schedules Popup Modal */}
                <Modal
                    isOpen={schedulesPopupOpen}
                    onClose={() => { setSchedulesPopupOpen(false); setSelectedScheduleForDetail(null); }}
                    title={`Schedules — ${selectedProject?.proposalNumber || ''} · ${selectedProject?.DisplayName || ''} · ${projectSchedules.length} schedule${projectSchedules.length !== 1 ? 's' : ''}`}
                    maxWidth="full"
                >
                    <div className="p-4">
                        {projectSchedules.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No schedules found for this job.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto">
                                {projectSchedules.map((item: any) => (
                                    <ScheduleCard
                                        key={item._id}
                                        item={item}
                                        initialData={{
                                            employees: employees.map(e => ({
                                                label: e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.email,
                                                value: e.email,
                                                image: e.profilePicture
                                            })),
                                            clients: [],
                                            constants: [],
                                            estimates: selectedProject?.proposalNumber ? [{ value: selectedProject.proposalNumber }] : []
                                        }}
                                        currentUser={null}
                                        onClick={() => {
                                            setSelectedScheduleForDetail(item);
                                            setScheduleDetailPopupOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </Modal>

                {/* Schedule Detail Popup */}
                <ScheduleDetailsPopup
                    isOpen={scheduleDetailPopupOpen}
                    onClose={() => {
                        setScheduleDetailPopupOpen(false);
                        setSelectedScheduleForDetail(null);
                    }}
                    schedule={selectedScheduleForDetail ? {
                        _id: selectedScheduleForDetail._id,
                        title: selectedScheduleForDetail.title,
                        estimate: selectedScheduleForDetail.estimate,
                        fromDate: selectedScheduleForDetail.fromDate,
                        toDate: selectedScheduleForDetail.toDate,
                        customerName: selectedScheduleForDetail.customerName || selectedProject?.CompanyName,
                        customerId: selectedScheduleForDetail.customerId,
                        jobLocation: selectedScheduleForDetail.jobLocation,
                        projectManager: selectedScheduleForDetail.projectManager,
                        foremanName: selectedScheduleForDetail.foremanName,
                        assignees: selectedScheduleForDetail.assignees,
                        description: selectedScheduleForDetail.description,
                        service: selectedScheduleForDetail.service || selectedScheduleForDetail.item,
                        notifyAssignees: selectedScheduleForDetail.notifyAssignees,
                        perDiem: selectedScheduleForDetail.perDiem,
                        certifiedPayroll: selectedScheduleForDetail.certifiedPayroll,
                        fringe: selectedScheduleForDetail.fringe,
                        hasJHA: selectedScheduleForDetail.hasJHA,
                        hasDJT: selectedScheduleForDetail.hasDJT,
                        timesheet: selectedScheduleForDetail.timesheet,
                        todayObjectives: selectedScheduleForDetail.todayObjectives,
                        aerialImage: selectedScheduleForDetail.aerialImage,
                        siteLayout: selectedScheduleForDetail.siteLayout,
                        projectName: selectedScheduleForDetail.title || selectedProject?.DisplayName,
                    } : null}
                    employees={employees.map(e => ({
                        label: e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.email,
                        value: e.email,
                        image: e.profilePicture
                    }))}
                    constants={[]}
                    currentUserEmail={undefined}
                />

                {/* JHAs Popup Modal */}
                <Modal
                    isOpen={jhasPopupOpen}
                    onClose={() => setJhasPopupOpen(false)}
                    title={`JHAs — ${selectedProject?.proposalNumber || ''} · ${selectedProject?.DisplayName || ''} · ${projectJHAs.length} JHA${projectJHAs.length !== 1 ? 's' : ''}`}
                    maxWidth="full"
                >
                    <div className="p-4">
                        {projectJHAs.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No JHAs found for this job.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-h-[70vh] overflow-y-auto">
                                {projectJHAs.map((jha: any, idx: number) => {
                                    const schedule = jha.scheduleRef;
                                    const clientName = schedule?.customerName || selectedProject?.CompanyName || '-';
                                    return (
                                        <JHACard
                                            key={`${jha._id || 'jha'}-${idx}`}
                                            jha={jha}
                                            schedule={schedule}
                                            clientName={clientName}
                                            employees={employees.map(e => ({
                                                value: e.email,
                                                label: e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.email,
                                                image: e.profilePicture,
                                                email: e.email,
                                            }))}
                                            canViewEstimates={true}
                                            canEdit={false}
                                            canDelete={false}
                                            onView={(jha) => {
                                                setSelectedWipJHA({ ...jha });
                                                setIsWipJhaEditMode(false);
                                                setWipJhaModalOpen(true);
                                            }}
                                            router={router}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Modal>

                {/* JHA View Modal from WIP */}
                {selectedWipJHA && (
                    <JHAModal
                        isOpen={wipJhaModalOpen}
                        onClose={() => { setWipJhaModalOpen(false); setSelectedWipJHA(null); }}
                        selectedJHA={selectedWipJHA}
                        setSelectedJHA={setSelectedWipJHA}
                        isEditMode={isWipJhaEditMode}
                        setIsEditMode={setIsWipJhaEditMode}
                        schedules={projectSchedules}
                        handleSave={async (e) => { e.preventDefault(); setWipJhaModalOpen(false); }}
                        initialData={{
                            employees: employees.map(e => ({
                                label: e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.email,
                                value: e.email,
                                image: e.profilePicture,
                            })),
                        }}
                        handleSaveSignature={async () => {}}
                        activeSignatureEmployee={wipJhaSignatureEmployee}
                        setActiveSignatureEmployee={setWipJhaSignatureEmployee}
                        isGeneratingPDF={isGeneratingWipJHAPDF}
                        handleDownloadPDF={async () => {}}
                        setEmailModalOpen={() => {}}
                    />
                )}

                {/* Tickets Popup Modal */}
                <Modal
                    isOpen={ticketsPopupOpen}
                    onClose={() => setTicketsPopupOpen(false)}
                    title={`Daily Job Tickets — ${selectedProject?.proposalNumber || ''} · ${selectedProject?.DisplayName || ''} · ${(selectedProject?.jobTickets || []).length} ticket${(selectedProject?.jobTickets || []).length !== 1 ? 's' : ''}`}
                    maxWidth="full"
                >
                    <div className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1" />
                            {(() => {
                                const tickets = selectedProject?.jobTickets || [];
                                if (tickets.length === 0) return null;
                                const totalEquip = tickets.reduce((s: number, t: any) => s + (t.equipmentCost || 0), 0);
                                const totalOH = tickets.reduce((s: number, t: any) => s + (t.overheadCost || 0), 0);
                                const totalCost = tickets.reduce((s: number, t: any) => s + (t.totalCost || 0), 0);
                                const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
                                return (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">Equip {fmt(totalEquip)}</span>
                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-md">OH {fmt(totalOH)}</span>
                                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md">Total {fmt(totalCost)}</span>
                                    </div>
                                );
                            })()}
                        </div>
                        {(selectedProject?.jobTickets || []).length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No job tickets found for this project.</p>
                            </div>
                        ) : (
                            <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                                        <tr className="h-9">
                                            <th className="px-3 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 align-middle">Date</th>
                                            <th className="px-3 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider align-middle">Description</th>
                                            <th className="px-3 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 align-middle">Equipment</th>
                                            <th className="px-3 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 align-middle">Overhead</th>
                                            <th className="px-3 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 text-right align-middle">Total Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {(selectedProject?.jobTickets || []).map((ticket: any, idx: number) => (
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
                                                <td className="px-3 py-2.5 text-xs font-medium text-slate-600 group-hover:text-[#0F4C75] whitespace-nowrap">{formatDateOnly(ticket.date)}</td>
                                                <td className="px-3 py-2.5 text-xs font-medium text-slate-600 truncate max-w-[300px]">{ticket.djtData?.dailyJobDescription || '—'}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold text-slate-700">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.equipmentCost || 0)}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-bold text-slate-700">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.overheadCost || 0)}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-black text-[#0F4C75] text-right">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.totalCost || 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Modal>
                {/* Hours Summary Modal */}
                <Modal
                    isOpen={hoursPopupOpen}
                    onClose={() => setHoursPopupOpen(false)}
                    title={`Hours Summary — ${selectedProject?.proposalNumber || ''} · ${selectedProject?.DisplayName || ''}`}
                    maxWidth="full"
                >
                    <div className="p-5">
                        {(() => {
                            // Build employee-date map for Reg/OT/DT calculation
                            // Key: `employee|YYYY-MM-DD`, Value: { siteHrs, driveHrs, scheduleTitles }
                            const dayMap = new Map<string, { employee: string; date: string; siteHrs: number; driveHrs: number; schedTitle: string }>();
                            
                            for (const sched of projectSchedules) {
                                const schedDate = sched.fromDate ? new Date(sched.fromDate).toISOString().split('T')[0] : 'unknown';
                                for (const ts of (sched.timesheet || [])) {
                                    // Use pre-stored hours if available; otherwise calculate from clockIn/clockOut
                                    let h: number;
                                    const storedHours = typeof ts.hours === 'number' ? ts.hours : parseFloat(ts.hours || '') || 0;
                                    if (storedHours > 0) {
                                        h = storedHours;
                                    } else {
                                        // Compute from clock times using the same utility as the Time Cards page
                                        const computed = calculateTimesheetData(ts, schedDate);
                                        h = computed.hours || 0;
                                    }
                                    if (h <= 0) continue;
                                    const emp = ts.employee || 'Unknown';
                                    const typeLower = (ts.type || '').toLowerCase();
                                    const isDrive = typeLower.includes('drive');
                                    // Use clockIn date if available, else schedule date
                                    let entryDate = schedDate;
                                    if (ts.clockIn) {
                                        try { entryDate = new Date(ts.clockIn).toISOString().split('T')[0]; } catch {}
                                    }
                                    const key = `${emp}|${entryDate}`;
                                    const existing = dayMap.get(key) || { employee: emp, date: entryDate, siteHrs: 0, driveHrs: 0, schedTitle: sched.title || '' };
                                    if (isDrive) {
                                        existing.driveHrs += h;
                                    } else {
                                        existing.siteHrs += h;
                                    }
                                    dayMap.set(key, existing);
                                }
                            }

                            // Calculate Reg/OT/DT per day per employee
                            let totalReg = 0, totalOT = 0, totalDT = 0, totalDrive = 0, totalSite = 0;
                            const employeeMap = new Map<string, { reg: number; ot: number; dt: number; drive: number; site: number; days: number }>();

                            for (const entry of dayMap.values()) {
                                const site = Math.round(entry.siteHrs * 100) / 100;
                                const drive = Math.round(entry.driveHrs * 100) / 100;

                                // Reg/OT/DT split for site time only
                                const reg = Math.min(site, 8);
                                const ot = Math.min(Math.max(site - 8, 0), 4);
                                const dt = Math.max(site - 12, 0);

                                totalReg += reg;
                                totalOT += ot;
                                totalDT += dt;
                                totalDrive += drive;
                                totalSite += site;

                                const empData = employeeMap.get(entry.employee) || { reg: 0, ot: 0, dt: 0, drive: 0, site: 0, days: 0 };
                                empData.reg += reg;
                                empData.ot += ot;
                                empData.dt += dt;
                                empData.drive += drive;
                                empData.site += site;
                                empData.days += 1;
                                employeeMap.set(entry.employee, empData);
                            }

                            const totalAll = totalSite + totalDrive;
                            const r2 = (n: number) => Math.round(n * 100) / 100;
                            const empEntries = Array.from(employeeMap.entries()).sort((a, b) => (b[1].reg + b[1].ot + b[1].dt + b[1].drive) - (a[1].reg + a[1].ot + a[1].dt + a[1].drive));

                            // Find employee display name helper
                            const getEmpName = (email: string) => {
                                const emp = employees.find(e => e.email === email);
                                return emp ? (emp.displayName || `${emp.firstName} ${emp.lastName}`.trim() || email) : email;
                            };

                            return (
                                <div className="space-y-6">
                                    {/* KPI Summary Bar */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Regular</p>
                                            <p className="text-2xl font-black text-emerald-900 tabular-nums">{r2(totalReg).toLocaleString()}h</p>
                                            <p className="text-[9px] text-emerald-600 font-medium mt-0.5">≤ 8 hrs/day</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">Overtime</p>
                                            <p className="text-2xl font-black text-amber-900 tabular-nums">{r2(totalOT).toLocaleString()}h</p>
                                            <p className="text-[9px] text-amber-600 font-medium mt-0.5">8–12 hrs/day</p>
                                        </div>
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">Double Time</p>
                                            <p className="text-2xl font-black text-rose-900 tabular-nums">{r2(totalDT).toLocaleString()}h</p>
                                            <p className="text-[9px] text-rose-600 font-medium mt-0.5">&gt; 12 hrs/day</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1">Drive Time</p>
                                            <p className="text-2xl font-black text-blue-900 tabular-nums">{r2(totalDrive).toLocaleString()}h</p>
                                            <p className="text-[9px] text-blue-600 font-medium mt-0.5">All drive entries</p>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-1">Total Hours</p>
                                            <p className="text-2xl font-black text-purple-900 tabular-nums">{r2(totalAll).toLocaleString()}h</p>
                                            <p className="text-[9px] text-purple-600 font-medium mt-0.5">Site + Drive</p>
                                        </div>
                                    </div>

                                    {/* Employee Breakdown Table */}
                                    {empEntries.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400">
                                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm font-medium">No timesheet data found for this project.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200">
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                                                    <tr className="h-10">
                                                        <th className="px-4 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider align-middle">Employee</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-16 text-center align-middle">Days</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-emerald-500 uppercase tracking-wider w-24 text-right align-middle">Regular</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-amber-500 uppercase tracking-wider w-24 text-right align-middle">OT</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-rose-500 uppercase tracking-wider w-24 text-right align-middle">DT</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 text-right align-middle">Site Total</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-blue-500 uppercase tracking-wider w-24 text-right align-middle">Drive</th>
                                                        <th className="px-4 py-0 text-[10px] font-black text-purple-500 uppercase tracking-wider w-24 text-right align-middle">Grand Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {empEntries.map(([email, data]) => {
                                                        const grandTotal = data.site + data.drive;
                                                        return (
                                                            <tr key={email} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        {(() => {
                                                                            const emp = employees.find(e => e.email === email);
                                                                            return emp?.profilePicture ? (
                                                                                <img src={emp.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                                            ) : (
                                                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                                    {getEmpName(email).charAt(0).toUpperCase()}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{getEmpName(email)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-bold text-slate-500 text-center tabular-nums">{data.days}</td>
                                                                <td className="px-4 py-3 text-xs font-black text-emerald-700 text-right tabular-nums">{r2(data.reg).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-xs font-black text-right tabular-nums">
                                                                    {data.ot > 0 ? <span className="text-amber-700">{r2(data.ot).toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-black text-right tabular-nums">
                                                                    {data.dt > 0 ? <span className="text-rose-700">{r2(data.dt).toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs font-black text-slate-700 text-right tabular-nums">{r2(data.site).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-xs font-black text-right tabular-nums">
                                                                    {data.drive > 0 ? <span className="text-blue-700">{r2(data.drive).toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-black text-purple-800 text-right tabular-nums">{r2(grandTotal).toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                                                    <tr className="font-black">
                                                        <td className="px-4 py-3 text-xs text-slate-600 uppercase">Totals ({empEntries.length} employees)</td>
                                                        <td className="px-4 py-3 text-xs text-slate-600 text-center tabular-nums">{dayMap.size}</td>
                                                        <td className="px-4 py-3 text-xs text-emerald-700 text-right tabular-nums">{r2(totalReg).toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-xs text-amber-700 text-right tabular-nums">{totalOT > 0 ? r2(totalOT).toFixed(2) : '—'}</td>
                                                        <td className="px-4 py-3 text-xs text-rose-700 text-right tabular-nums">{totalDT > 0 ? r2(totalDT).toFixed(2) : '—'}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-700 text-right tabular-nums">{r2(totalSite).toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-xs text-blue-700 text-right tabular-nums">{totalDrive > 0 ? r2(totalDrive).toFixed(2) : '—'}</td>
                                                        <td className="px-4 py-3 text-sm text-purple-800 text-right tabular-nums">{r2(totalAll).toFixed(2)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </Modal>
            </TooltipProvider>
        </div>
    );
}
