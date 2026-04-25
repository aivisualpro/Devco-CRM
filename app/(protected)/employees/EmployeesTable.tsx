'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Upload, Pencil, Trash2, Plus, Phone, Mail, ChevronDown, Shield, UserCog, Users, User, Eye, Lock, Settings } from 'lucide-react';
import { Header, Button, AddButton, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs, Modal, ConfirmModal, Input, Tabs, UnderlineTabs, SaveButton, CancelButton, MyDropDown, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useToast } from '@/hooks/useToast';
import { EmployeeForm } from '@/components/employees/EmployeeForm';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { useInfiniteEmployees } from '@/lib/hooks/api';
import { DataTable, ColumnDef } from '@/components/data-table/DataTable';

interface Employee {
    _id: string; // email
    firstName: string;
    lastName: string;
    email: string;
    recordId?: string;
    phone?: string;
    mobile?: string;
    appRole?: string;
    companyPosition?: string;
    designation?: string;
    isScheduleActive?: boolean;
    status: string;
    groupNo?: string;
    hourlyRateSITE?: number;
    hourlyRateDrive?: number;
    dob?: string;
    driverLicense?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    password?: string;

    // Documents / Checks / Dates
    applicationResume?: string;
    dateHired?: string;
    separationDate?: string;
    separationReason?: string;

    // Compliance & Files
    employeeHandbook?: string;
    quickbooksW4I9DD?: string;
    workforce?: string;
    emergencyContact?: string;
    dotRelease?: string;
    dmvPullNotifications?: string;
    drivingRecordPermission?: string;
    backgroundCheck?: string;
    copyOfDL?: string;
    copyOfSS?: string;
    lcpTracker?: string;
    edd?: string;
    autoInsurance?: string;
    veriforce?: string;
    unionPaperwork1184?: string;
    profilePicture?: string;
    signature?: string;

    // Record Arrays
    documents?: any[];
    drugTestingRecords?: any[];
    trainingCertifications?: any[];
}



// Icon mapping for roles
const ROLE_ICONS: Record<string, React.ReactNode> = {
    Shield: <Shield className="w-3.5 h-3.5" />,
    UserCog: <UserCog className="w-3.5 h-3.5" />,
    Users: <Users className="w-3.5 h-3.5" />,
    User: <User className="w-3.5 h-3.5" />,
    Eye: <Eye className="w-3.5 h-3.5" />,
    Lock: <Lock className="w-3.5 h-3.5" />,
    Settings: <Settings className="w-3.5 h-3.5" />,
};

const defaultEmployee: Partial<Employee> = {
    firstName: '',
    lastName: '',
    recordId: '',
    email: '',
    phone: '',
    mobile: '',
    status: 'Active',
    isScheduleActive: true,
    appRole: '',
    companyPosition: '',
    designation: '',
    groupNo: '',
    hourlyRateSITE: 0,
    hourlyRateDrive: 0,
    address: '',
    city: '',
    state: '',
    zip: '',
    password: '',

    // Default compliance fields to empty or '-'
    applicationResume: '',
    employeeHandbook: '',
    quickbooksW4I9DD: '',
    workforce: '',
    emergencyContact: '',
    dotRelease: '',
    dmvPullNotifications: '',
    drivingRecordPermission: '',
    backgroundCheck: '',
    copyOfDL: '',
    copyOfSS: '',
    lcpTracker: '',
    edd: '',
    autoInsurance: '',
    veriforce: '',

    unionPaperwork1184: '',
    profilePicture: ''
};

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};


export default function EmployeesTable({ initialData }: { initialData?: any[] }) {
    const router = useRouter();
    const { can } = usePermissions();
    const canEdit = can(MODULES.EMPLOYEES, ACTIONS.EDIT);
    const canDelete = can(MODULES.EMPLOYEES, ACTIONS.DELETE);
    const canCreate = can(MODULES.EMPLOYEES, ACTIONS.CREATE);

    const [activeTab, setActiveTab] = useState('All');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<any>({ key: 'updatedAt', direction: 'desc' });

    const {
        items: employees,
        size,
        setSize,
        isLoading: loading,
        isValidating,
        hasMore,
        mutate: refetchEmployees
    } = useInfiniteEmployees({
        q: search,
        status: activeTab === 'All' ? undefined : activeTab,
        limit: 25
    });

    const [roles, setRoles] = useState<any[]>([]);
    useEffect(() => {
        fetch('/api/roles').then(res => res.json()).then(data => {
            if (data.success && data.result) {
                setRoles(data.result);
            }
        }).catch(() => {});
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee> | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const { success, error } = useToast();

    const openAddModal = () => { setCurrentEmployee(defaultEmployee); setIsModalOpen(true); };
    const openEditModal = (emp: Employee) => { setCurrentEmployee(emp); setIsModalOpen(true); };
    const openDeleteModal = (emp: Employee) => { setEmployeeToDelete(emp); setIsDeleteModalOpen(true); };

    const handleDelete = async () => {
        if (!employeeToDelete) return;
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteEmployee', payload: { id: employeeToDelete._id } })
            });
            const data = await res.json();
            if (data.success) {
                success('Employee deleted successfully');
                refetchEmployees();
            } else {
                error('Failed to delete employee');
            }
        } catch (err) {
            error('An error occurred');
        }
        setIsDeleteModalOpen(false);
    };

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Basic placeholder since full import logic was removed
        setIsImporting(true);
        setTimeout(() => { setIsImporting(false); success('Import function pending.'); }, 1000);
    };

    const tabs = [
        { id: 'All', label: 'All Employees' },
        { id: 'Active', label: 'Active' },
        { id: 'Inactive', label: 'Inactive' },
        { id: 'Terminated', label: 'Terminated' }
    ];

    const columns: ColumnDef<Employee>[] = [
        {
            key: 'name',
            header: 'Name',
            width: '250px',
            sortable: true,
            cell: (emp) => (
                <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold overflow-hidden border border-slate-200 shadow-sm shrink-0">
                        {emp.profilePicture ? (
                            <div className="relative w-full h-full">
                                <Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(emp.profilePicture, { w: 1200 })} alt="" className="object-cover w-full h-full" />
                            </div>
                        ) : (
                            (emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')
                        )}
                    </div>
                    <span className="truncate font-medium">{emp.firstName} {emp.lastName}</span>
                </div>
            )
        },
        { 
            key: 'recordId', 
            header: 'Employee ID', 
            sortable: true, 
            cell: emp => <span className="text-sm text-gray-600">{emp.recordId || '-'}</span> 
        },
        { 
            key: 'companyPosition', 
            header: 'Position', 
            sortable: true, 
            cell: emp => <span className="text-sm">{emp.companyPosition || '-'}</span> 
        },
        { 
            key: 'email', 
            header: 'Email', 
            sortable: true, 
            cell: emp => <span className="text-sm">{emp.email}</span> 
        },
        { 
            key: 'mobile', 
            header: 'Phone', 
            sortable: true, 
            cell: emp => (
                <a href={`tel:${emp.mobile || emp.phone}`} className="hover:text-indigo-600 hover:underline whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                    {(emp.mobile || emp.phone || '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                </a>
            )
        },
        { 
            key: 'appRole', 
            header: 'App Role', 
            sortable: true, 
            cell: emp => {
                const role = roles.find(r => r.name === emp.appRole);
                if (role) {
                    return (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap" style={{ backgroundColor: `${role.color}15`, color: role.color, borderColor: `${role.color}30` }}>
                            {role.name}
                        </div>
                    );
                }
                return <span className="text-sm">{emp.appRole || '-'}</span>;
            }
        },
        { 
            key: 'status', 
            header: 'Status', 
            sortable: true, 
            cell: emp => (
                <Badge variant={emp.status === 'Active' ? 'success' : 'default'} className="whitespace-nowrap">
                    {emp.status || 'Active'}
                </Badge>
            )
        },
        { 
            key: 'actions', 
            header: 'Actions', 
            cell: emp => (
                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => openEditModal(emp)} className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-[#0F4C75] hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit Employee</p></TooltipContent>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => openDeleteModal(emp)} className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full border border-slate-100 shadow-sm transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Employee</p></TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )
        }
    ];

    const mobileCard = (emp: Employee) => (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98] flex flex-col items-center text-center relative" onClick={() => router.push(`/employees/${encodeURIComponent(emp._id)}`)}>
            <div className="relative w-16 h-16 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden mb-3 shrink-0">
                {emp.profilePicture ? (
                    <div className="relative w-full h-full">
                        <Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(emp.profilePicture, { w: 1200 })} alt="" className="object-cover w-full h-full" />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-normal text-slate-400">
                        {(emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')}
                    </div>
                )}
            </div>
            <h3 className="font-normal text-slate-600 text-sm line-clamp-1 leading-tight mb-1">{emp.firstName} {emp.lastName}</h3>
            <p className="text-xs font-medium text-slate-400 mb-3 truncate w-full">{emp.companyPosition || emp.appRole || '-'}</p>
            <div className="flex items-center gap-2 mt-auto pt-3 w-full border-t border-slate-50 justify-center">
                <a href={`tel:${emp.mobile || emp.phone}`} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" onClick={e => e.stopPropagation()}><Phone size={14} /></a>
                <a href={`mailto:${emp.email}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" onClick={e => e.stopPropagation()}><Mail size={14} /></a>
                <Badge variant={emp.status === 'Active' ? 'success' : 'default'} className="text-[10px] py-0 px-2 h-5 uppercase ml-auto">{emp.status || 'Active'}</Badge>
            </div>
        </div>
    );

    const toolbar = (
        <>
            <Header
                hideLogo={false}
                rightContent={
                    <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end md:flex-initial">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search employees..."
                        />
                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImport}
                        />
                        {canCreate && (
                            <div className="hidden lg:block">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isImporting}
                                            className={`w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 hover:text-[#0F4C75] transition-all shadow-sm ${isImporting ? 'animate-pulse cursor-not-allowed' : ''}`}
                                        >
                                            <Upload size={18} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{isImporting ? 'Importing...' : 'Import CSV'}</p></TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                        {canCreate && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={openAddModal}
                                        variant="default"
                                        size="icon"
                                        className="rounded-full shadow-lg active:scale-95 transition-transform"
                                    >
                                        <Plus size={24} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Add New</p></TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                }
            />
            <div className="hidden lg:flex justify-center mb-2 px-4">
                <BadgeTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </div>
        </>
    );

    return (
        <div className="h-[100dvh] w-full flex flex-col">
            <DataTable
                columns={columns}
                data={employees}
                isLoading={loading}
                isLoadingMore={isValidating && !loading}
                hasMore={hasMore}
                onLoadMore={() => setSize(size + 1)}
                sortConfig={sortConfig}
                onSort={handleSort as any}
                emptyState={{ 
                    icon: <Users className="w-12 h-12" />, 
                    title: 'No employees found', 
                    description: 'Get started by adding a new employee.' 
                }}
                onRowClick={(emp) => router.push(`/employees/${encodeURIComponent(emp._id)}`)}
                toolbar={toolbar}
                mobileCard={mobileCard}
            />

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <EmployeeForm
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    initialData={currentEmployee as any}
                    onSave={refetchEmployees}
                    roles={roles}
                />
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Employee"
                message={`Are you sure you want to delete ${employeeToDelete?.firstName} ${employeeToDelete?.lastName}? This action cannot be undone.`}
                confirmText="Delete Employee"
            />
        </div>
    );
}
