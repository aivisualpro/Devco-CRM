'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Upload, Pencil, Trash2, Plus, Phone, Mail, ChevronDown } from 'lucide-react';
import { Header, Button, AddButton, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, Badge, SkeletonTable, BadgeTabs, Modal, ConfirmModal, Input, Tabs, UnderlineTabs, SaveButton, CancelButton, MyDropDown } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Employee {
    _id: string; // email
    firstName: string;
    lastName: string;
    email: string;
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
}


const defaultEmployee: Partial<Employee> = {
    firstName: '',
    lastName: '',
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

const FormSelect = ({ label, value, onChange, options, placeholder, allowAdd = true, multiSelect = false }: { label: string, value: string, onChange: (val: string) => void, options: string[], placeholder?: string, allowAdd?: boolean, multiSelect?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (val: string) => {
        if (multiSelect) {
            const current = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
            const idx = current.indexOf(val);
            let newValues;
            if (idx >= 0) {
                newValues = current.filter(c => c !== val);
            } else {
                newValues = [...current, val];
            }
            onChange(newValues.join(', '));
        } else {
            onChange(val);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative">
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div 
                className="w-full h-10 px-3 py-2 bg-white border border-gray-300 rounded-lg flex items-center justify-between cursor-pointer hover:border-[#0F4C75] transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate mr-2">
                    <span className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {value || placeholder || 'Select...'}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            
            <MyDropDown
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                options={options.map(o => ({ id: o, label: o, value: o }))}
                selectedValues={value ? value.split(',').map(s => s.trim()).filter(Boolean) : []}
                onSelect={handleSelect}
                onAdd={allowAdd ? async (val) => {
                    handleSelect(val);
                } : undefined}
                width="w-full"
                placeholder={`Search ${label || 'options'}...`}
                multiSelect={multiSelect}
            />
        </div>
    );
};

import { useRouter } from 'next/navigation';

const RoleBadge = ({ value, color }: { value: string, color?: string }) => {
    if (!value) return null;
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item, i) => (
                <div 
                    key={i} 
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                        color 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                >
                    {item}
                </div>
            ))}
        </div>
    );
};

export default function EmployeesPage() {
    const router = useRouter();
    const { success, error } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('active');
    const [visibleCount, setVisibleCount] = useState(20);
    const itemsPerPage = 15;
    const observerTarget = useRef(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>(defaultEmployee);
    const [modalTab, setModalTab] = useState('personal'); // personal, employment, compliance

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

    const [selectedPosition, setSelectedPosition] = useState('All');
    const [selectedDesignation, setSelectedDesignation] = useState('All');


    // Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    async function fetchEmployees() {
        setLoading(true);
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
        setLoading(false);
    }

    useEffect(() => {
        fetchEmployees();
    }, []);


    const [sortConfig, setSortConfig] = useState<{ key: keyof Employee | 'name'; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });

    const handleSort = (key: keyof Employee | 'name') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Calculate tab counts (basic status counts)
    const counts = useMemo(() => {
        return {
            all: employees.length,
            active: employees.filter(c => c.status === 'Active').length,
            inactive: employees.filter(c => c.status !== 'Active').length
        };
    }, [employees]);

    // Filter by Tab, Search, Position, Designation then Sort
    const filteredEmployees = useMemo(() => {
        return employees.filter(c => {
            // Tab filter
            if (activeTab === 'active' && c.status !== 'Active') return false;
            if (activeTab === 'inactive' && c.status === 'Active') return false;

            // Dropdown filters
            if (selectedPosition !== 'All' && c.companyPosition !== selectedPosition) return false;
            if (selectedDesignation !== 'All' && c.designation !== selectedDesignation) return false;

            // Search filter
            if (search) {
                const lowerSearch = search.toLowerCase();
                return (
                    (c.firstName || '').toLowerCase().includes(lowerSearch) ||
                    (c.lastName || '').toLowerCase().includes(lowerSearch) ||
                    (c.email || '').toLowerCase().includes(lowerSearch) ||
                    (c.companyPosition || '').toLowerCase().includes(lowerSearch) ||
                    (c.appRole || '').toLowerCase().includes(lowerSearch)
                );
            }
            return true;
        }).sort((a, b) => {
            if (!sortConfig) return 0;

            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'name') {
                aValue = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
                bValue = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
            } else {
                aValue = (a[sortConfig.key] || '').toString().toLowerCase();
                bValue = (b[sortConfig.key] || '').toString().toLowerCase();
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [employees, activeTab, selectedPosition, selectedDesignation, search, sortConfig]);

    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const mobileEmployees = filteredEmployees.slice(0, visibleCount);
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

    // Reset pagination and visible count when filters change
    useEffect(() => {
        setCurrentPage(1);
        setVisibleCount(20);
    }, [search, activeTab, selectedPosition, selectedDesignation]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredEmployees.length) {
                    setVisibleCount(prev => prev + 20);
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [filteredEmployees.length, visibleCount]);





    // Unique options for filters
    const filterPositionOptions = useMemo(() => ['All', ...Array.from(new Set(employees.map(e => e.companyPosition).filter(Boolean)))], [employees]);
    const filterDesignationOptions = useMemo(() => ['All', ...Array.from(new Set(employees.map(e => e.designation).filter(Boolean)))], [employees]);

    const tabs = [
        { id: 'all', label: 'All Employees', count: counts.all },
        { id: 'active', label: 'Active', count: counts.active },
        { id: 'inactive', label: 'Inactive', count: counts.inactive }
    ];

    const modalTabs = [
        { id: 'personal', label: 'Personal Info' },
        { id: 'employment', label: 'Employment Details' },
        { id: 'compliance', label: 'Files & Compliance' }
    ];

    // Derived Options for SearchableSelects
    const getOptions = (key: keyof Employee) => {
        const unique = new Set(employees.map(e => e[key]).filter(Boolean));
        return Array.from(unique) as string[];
    };

    // Helper to get split options
    const getSplitOptions = (key: keyof Employee) => {
        const raw = employees.map(e => e[key]).filter(Boolean) as string[];
        const split = raw.flatMap(s => s.split(',').map(x => x.trim()));
        return Array.from(new Set(split));
    };

    const appRoleOptions = getOptions('appRole');
    const positionOptions = getOptions('companyPosition');
    const designationOptions = Array.from(new Set(['Foreman', 'Project Manager', 'SITE Coordinator', ...getSplitOptions('designation')]));
    const cityOptions = getOptions('city');
    const stateOptions = getOptions('state');

    // Helper for compliance fields options - usually statuses like "Yes", "No", "Pending", "N/A" + any existing custom ones
    const getComplianceOptions = (key: keyof Employee) => {
        const std = ['Yes', 'No', 'Pending', 'N/A'];
        const existing = getOptions(key);
        return Array.from(new Set([...std, ...existing]));
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const rows = text.split('\n');
                const headers = rows[0].split(',').map(h => h.trim());

                const parsedEmployees = rows.slice(1).filter(r => r.trim()).map(row => {
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
                    const emp: any = {};
                    headers.forEach((h, i) => {
                        const key = h.replace(/^"|"$/g, '');
                        if (key && values[i]) emp[key] = values[i];
                    });
                    return emp;
                });

                if (parsedEmployees.length === 0) throw new Error("No valid data found");

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importEmployees', payload: { employees: parsedEmployees } })
                });

                const data = await res.json();
                if (data.success) {
                    success(`Successfully imported ${parsedEmployees.length} employees`);
                    fetchEmployees();
                } else {
                    error('Import failed: ' + data.error);
                }
            } catch (err) {
                error('Error parsing CSV file');
                console.error(err);
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // CRUD Handlers
    const openAddModal = () => {
        setCurrentEmployee({ ...defaultEmployee });
        setModalTab('personal');
        setIsModalOpen(true);
    };

    const openEditModal = (emp: Employee) => {
        setCurrentEmployee({ ...emp });
        setModalTab('personal');
        setIsModalOpen(true);
    };

    const openDeleteModal = (emp: Employee) => {
        setEmployeeToDelete(emp);
        setIsDeleteModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentEmployee.firstName || !currentEmployee.lastName || !currentEmployee.email) {
            error('First Name, Last Name and Email are required');
            return;
        }

        setSaving(true);
        try {
            const action = currentEmployee._id ? 'updateEmployee' : 'addEmployee';
            const payload = currentEmployee._id
                ? { id: currentEmployee._id, item: currentEmployee }
                : { item: currentEmployee };

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });

            const data = await res.json();
            if (data.success) {
                success(currentEmployee._id ? 'Employee updated successfully' : 'Employee added successfully');
                setIsModalOpen(false);
                fetchEmployees();
            } else {
                error('Failed to save employee: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving employee:', err);
            error('An error occurred while saving');
        } finally {
            setSaving(false);
        }
    };

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
                fetchEmployees();
            } else {
                error('Failed to delete employee');
            }
        } catch (err) {
            console.error('Error deleting employee:', err);
            error('An error occurred while deleting');
        }
        setIsDeleteModalOpen(false);
        setEmployeeToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-none">
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
                        <div className="hidden lg:block">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                                className={`w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 hover:text-[#0F4C75] transition-all shadow-sm ${isImporting ? 'animate-pulse cursor-not-allowed' : ''}`}
                                title={isImporting ? 'Importing...' : 'Import CSV'}
                            >
                                <Upload size={18} />
                            </button>
                        </div>

                        <button
                            onClick={openAddModal}
                            className="w-10 h-10 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 hover:bg-[#0b3c5d] transition-all"
                            title="Add New"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                }
            />

            </div>

            <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex md:flex-col pt-4 px-4 pb-0">
                {/* Tabs - Hidden on Mobile */}
                <div className="hidden md:flex justify-center mb-4">
                    <BadgeTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>


                {loading ? (
                    <>
                        <div className="md:hidden grid grid-cols-2 gap-2">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                            ))}
                        </div>
                        <div className="hidden md:block">
                            <SkeletonTable rows={10} columns={7} />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Mobile Card View - 2 Columns */}
                        <div className="md:hidden grid grid-cols-2 gap-2 pb-8">
                            {mobileEmployees.length === 0 ? (
                                <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-slate-500 font-medium">No employees found</p>
                                </div>
                            ) : (
                                mobileEmployees.map((emp) => (
                                    <div
                                        key={emp._id}
                                        className="bg-white rounded-2xl p-3 shadow-sm border border-slate-50 hover:border-slate-100 transition-all active:scale-[0.98] flex flex-col items-center text-center"
                                        onClick={() => router.push(`/employees/${encodeURIComponent(emp._id)}`)}
                                    >
                                        <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-white shadow-sm overflow-hidden mb-3">
                                            {emp.profilePicture ? (
                                                <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-indigo-300">
                                                    {(emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')}
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="font-bold text-slate-800 text-sm line-clamp-1 leading-tight mb-1">
                                            {emp.firstName} {emp.lastName}
                                        </h3>

                                        <p className="text-[10px] font-medium text-slate-400 mb-2 truncate w-full">
                                            {emp.companyPosition || emp.appRole || '-'}
                                        </p>

                                        <div className="flex items-center gap-2 mt-auto pt-2 w-full border-t border-slate-50 justify-center">
                                            <a
                                                href={`tel:${emp.mobile || emp.phone}`}
                                                className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Phone size={12} />
                                            </a>
                                            <a
                                                href={`mailto:${emp.email}`}
                                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Mail size={12} />
                                            </a>
                                            <Badge variant={emp.status === 'Active' ? 'success' : 'default'} className="text-[8px] py-0 px-1.5 h-4 uppercase">
                                                {emp.status || 'Active'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={observerTarget} className="h-4 col-span-2" />
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 pb-4">
                        <Table
                            containerClassName="h-full min-h-[400px]"
                            footer={
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            }
                        >
                                <TableHead>
                                    <TableRow>
                                        <TableHeader
                                            onClick={() => handleSort('name')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'name' ? sortConfig.direction : null}
                                        >
                                            Name
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('companyPosition')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'companyPosition' ? sortConfig.direction : null}
                                        >
                                            Position
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('email')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'email' ? sortConfig.direction : null}
                                        >
                                            Email
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('mobile')} // sorting by mobile/phone
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'mobile' ? sortConfig.direction : null}
                                        >
                                            Phone
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('designation')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'designation' ? sortConfig.direction : null}
                                        >
                                            Designation
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('appRole')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'appRole' ? sortConfig.direction : null}
                                        >
                                            App Role
                                        </TableHeader>
                                        <TableHeader
                                            onClick={() => handleSort('status')}
                                            sortable={true}
                                            sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                                        >
                                            Status
                                        </TableHeader>
                                        <TableHeader className="text-right">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedEmployees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <p className="text-base font-medium text-gray-900">No employees found</p>
                                                    <p className="text-sm text-gray-500 mt-1">Get started by adding a new employee.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedEmployees.map((emp) => (
                                            <TableRow
                                                key={emp._id}
                                                onClick={() => router.push(`/employees/${encodeURIComponent(emp._id)}`)}
                                                className="cursor-pointer hover:bg-gray-50/80 transition-colors"
                                            >
                                                <TableCell className="font-medium text-gray-900">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold overflow-hidden border border-indigo-200 shadow-sm">
                                                            {emp.profilePicture ? (
                                                                <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                (emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')
                                                            )}
                                                        </div>
                                                        <span>{emp.firstName} {emp.lastName}</span>
                                                    </div>
                                                </TableCell>

                                                <TableCell>{emp.companyPosition || '-'}</TableCell>
                                                <TableCell>{emp.email}</TableCell>
                                                <TableCell>
                                                    <a href={`tel:${emp.mobile || emp.phone}`} className="hover:text-indigo-600 hover:underline">
                                                        {(emp.mobile || emp.phone || '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                                                    </a>

                                                </TableCell>
                                                <TableCell>
                                                    <RoleBadge value={emp.designation || ''} color="bg-emerald-600" />
                                                </TableCell>
                                                <TableCell>
                                                    <RoleBadge value={emp.appRole || ''} />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={emp.status === 'Active' ? 'success' : 'default'}>
                                                        {emp.status || 'Active'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openEditModal(emp);
                                                            }}
                                                            className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-[#0F4C75] hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm transition-all"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDeleteModal(emp);
                                                            }}
                                                            className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full border border-slate-100 shadow-sm transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>

                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={currentEmployee._id ? 'Edit Employee' : 'New Employee'}
                footer={
                    <>
                        <CancelButton onClick={() => setIsModalOpen(false)} />
                        <SaveButton onClick={handleSave} loading={saving} />
                    </>
                }
            >
                <div className="mb-6">
                    <UnderlineTabs
                        tabs={modalTabs}
                        activeTab={modalTab}
                        onChange={setModalTab}
                    />
                </div>



                <div className="pb-4">
                    {modalTab === 'personal' && (
                        <div className="grid grid-cols-12 gap-4">
                            {/* Profile Picture Upload */}
                            <div className="col-span-12 flex flex-col items-center justify-center mb-4">
                                <div className="relative group cursor-pointer">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shadow-lg border-2 border-white">
                                        {currentEmployee.profilePicture ? (
                                            <img
                                                src={currentEmployee.profilePicture}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-2xl font-bold text-gray-400">
                                                {currentEmployee.firstName?.[0]}{currentEmployee.lastName?.[0]}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Pencil className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setCurrentEmployee({ ...currentEmployee, profilePicture: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 mt-2">Click to upload photo</span>
                            </div>


                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                <Input
                                    value={currentEmployee.firstName || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, firstName: e.target.value })}
                                    autoFocus={true}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                <Input
                                    value={currentEmployee.lastName || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, lastName: e.target.value })}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                <Input
                                    value={currentEmployee.dob || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, dob: e.target.value })}
                                    type="date"
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email (ID) *</label>
                                <Input
                                    value={currentEmployee.email || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, email: e.target.value })}
                                    type="email"
                                    disabled={!!currentEmployee._id}
                                />
                                {!!currentEmployee._id && <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>}
                            </div>

                            <div className="col-span-12 md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <Input
                                    value={currentEmployee.phone || ''}
                                    onChange={(e) => {
                                        const formattedValue = formatPhoneNumber(e.target.value);
                                        setCurrentEmployee({ ...currentEmployee, phone: formattedValue });
                                    }}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                                <Input
                                    value={currentEmployee.mobile || ''}
                                    onChange={(e) => {
                                        const formattedValue = formatPhoneNumber(e.target.value);
                                        setCurrentEmployee({ ...currentEmployee, mobile: formattedValue });
                                    }}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <Input
                                    value={currentEmployee.password || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, password: e.target.value })}
                                />
                            </div>

                            <div className="col-span-12">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <Input
                                    value={currentEmployee.address || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, address: e.target.value })}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-4">
                                <FormSelect
                                    label="City"
                                    value={currentEmployee.city || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, city: val })}
                                    options={cityOptions}
                                    placeholder="Select or type city..."
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <FormSelect
                                    label="State"
                                    value={currentEmployee.state || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, state: val })}
                                    options={stateOptions}
                                    placeholder="State"
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                                <Input
                                    value={currentEmployee.zip || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, zip: e.target.value })}
                                />
                            </div>

                            <div className="col-span-12">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Driver License</label>
                                <Input
                                    value={currentEmployee.driverLicense || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, driverLicense: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {modalTab === 'employment' && (
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-6">
                                <FormSelect
                                    label="App Role"
                                    value={currentEmployee.appRole || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, appRole: val })}
                                    options={appRoleOptions}
                                    allowAdd={true}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <FormSelect
                                    label="Company Position"
                                    value={currentEmployee.companyPosition || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, companyPosition: val })}
                                    options={positionOptions}
                                    allowAdd={true}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-4">
                                <FormSelect
                                    label="Designation"
                                    value={currentEmployee.designation || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, designation: val })}
                                    options={designationOptions}
                                    allowAdd={true}
                                    multiSelect={true}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group No</label>
                                <Input
                                    value={currentEmployee.groupNo || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, groupNo: e.target.value })}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Hired</label>
                                <Input
                                    value={currentEmployee.dateHired || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, dateHired: e.target.value })}
                                    type="date"
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (SITE)</label>
                                <Input
                                    value={currentEmployee.hourlyRateSITE || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, hourlyRateSITE: parseFloat(e.target.value) || 0 })}
                                    type="number"
                                />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (Drive)</label>
                                <Input
                                    value={currentEmployee.hourlyRateDrive || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, hourlyRateDrive: parseFloat(e.target.value) || 0 })}
                                    type="number"
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <FormSelect
                                    label="Status"
                                    value={currentEmployee.status || 'Active'}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, status: val })}
                                    options={['Active', 'Inactive', 'Terminated']}
                                    allowAdd={false}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <FormSelect
                                    label="Schedule Active"
                                    value={currentEmployee.isScheduleActive ? 'Yes' : 'No'}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, isScheduleActive: val === 'Yes' })}
                                    options={['Yes', 'No']}
                                    allowAdd={false}
                                />
                            </div>

                            {(currentEmployee.status === 'Terminated' || currentEmployee.status === 'Inactive') && (
                                <>
                                    <div className="col-span-12 md:col-span-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Separation Date</label>
                                        <Input
                                            value={currentEmployee.separationDate || ''}
                                            onChange={(e) => setCurrentEmployee({ ...currentEmployee, separationDate: e.target.value })}
                                            type="date"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Separation Reason</label>
                                        <Input
                                            value={currentEmployee.separationReason || ''}
                                            onChange={(e) => setCurrentEmployee({ ...currentEmployee, separationReason: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {modalTab === 'compliance' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { key: 'applicationResume', label: 'Application / Resume' },
                                { key: 'employeeHandbook', label: 'Employee Handbook' },
                                { key: 'quickbooksW4I9DD', label: 'Quickbooks / W4 / I9 / DD' },
                                { key: 'workforce', label: 'Workforce Hub' },
                                { key: 'emergencyContact', label: 'Emergency Contact Form' },
                                { key: 'dotRelease', label: 'DOT Release' },
                                { key: 'dmvPullNotifications', label: 'DMV Pull Notifications' },
                                { key: 'drivingRecordPermission', label: 'Driving Record Permission' },
                                { key: 'backgroundCheck', label: 'Background Check' },
                                { key: 'copyOfDL', label: 'Copy of DL' },
                                { key: 'copyOfSS', label: 'Copy of SS / Passport / Birth Cert' },
                                { key: 'lcpTracker', label: 'LCP Tracker' },
                                { key: 'edd', label: 'EDD' },
                                { key: 'autoInsurance', label: 'Auto Insurance' },
                                { key: 'veriforce', label: 'Veriforce' },
                                { key: 'unionPaperwork1184', label: 'Union Paperwork (1184)' },
                            ].map((field) => (
                                <div key={field.key} className="col-span-1">
                                    <FormSelect
                                        label={field.label}
                                        value={(currentEmployee as any)[field.key] || ''}
                                        onChange={(val) => setCurrentEmployee({ ...currentEmployee, [field.key]: val })}
                                        options={getComplianceOptions(field.key as keyof Employee)}
                                        placeholder="Select status..."
                                        allowAdd={true}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal >

            {/* Delete Confirmation Modal */}
            < ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)
                }
                onConfirm={handleDelete}
                title="Delete Employee"
                message={`Are you sure you want to delete ${employeeToDelete?.firstName} ${employeeToDelete?.lastName}? This action cannot be undone.`}
                confirmText="Delete Employee"
            />

        </div>
    );
}
