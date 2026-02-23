'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, Trash2, ArrowLeft, Briefcase, FileText, User, Pencil, FlaskConical, GraduationCap, X, Check, Plus, Upload } from 'lucide-react';
import { Header, Button, ConfirmModal, Modal, Input, SearchableSelect, UnderlineTabs, SaveButton, CancelButton, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useToast } from '@/hooks/useToast';
import { EmployeeHeaderCard, AccordionCard, DetailRow } from './components';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types (Mirrors Employee Interface)
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
    applicationResume?: string;
    dateHired?: string;
    separationDate?: string;
    separationReason?: string;
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

    // Sub-document arrays
    documents?: Array<{ date?: string; type?: string; description?: string; fileUrl?: string }>;
    drugTestingRecords?: Array<{ date?: string; type?: string; description?: string; fileUrl?: string }>;
    trainingCertifications?: Array<{ category?: string; type?: string; frequency?: string; assignedDate?: string; completionDate?: string; renewalDate?: string; description?: string; status?: string; fileUrl?: string; createdBy?: string; createdAt?: string }>;

    [key: string]: any;
}

export default function EmployeeViewPage() {
    const router = useRouter();
    const params = useParams();
    const id = decodeURIComponent(params.id as string);
    const { success, error: toastError } = useToast();
    const { can } = usePermissions();
    const canViewEmployees = can(MODULES.EMPLOYEES, ACTIONS.VIEW);

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [animate, setAnimate] = useState(false);

    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'personal': true,
        'employment': true,
        'compliance': false
    });

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({});
    const [modalTab, setModalTab] = useState('personal');

    const [saving, setSaving] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    // Training record editing state
    const [editingTrainingIdx, setEditingTrainingIdx] = useState<number | null>(null);
    const [editingTraining, setEditingTraining] = useState<any>(null);
    const [savingTraining, setSavingTraining] = useState(false);
    const [deletingTrainingIdx, setDeletingTrainingIdx] = useState<number | null>(null);
    const [isAddingTraining, setIsAddingTraining] = useState(false);
    const emptyTraining = { category: '', type: '', frequency: '', assignedDate: '', completionDate: '', renewalDate: '', description: '', status: '', fileUrl: '', createdBy: '', createdAt: '' };
    const [newTraining, setNewTraining] = useState<any>({ ...emptyTraining });

    // Document adding state
    const [isAddingDocument, setIsAddingDocument] = useState(false);
    const emptyDocument = { date: '', type: '', description: '', fileUrl: '' };
    const [newDocument, setNewDocument] = useState<any>({ ...emptyDocument });
    const [savingDocument, setSavingDocument] = useState(false);

    // Drug testing adding state
    const [isAddingDrugTest, setIsAddingDrugTest] = useState(false);
    const emptyDrugTest = { date: '', type: '', description: '', fileUrl: '' };
    const [newDrugTest, setNewDrugTest] = useState<any>({ ...emptyDrugTest });
    const [savingDrugTest, setSavingDrugTest] = useState(false);

    const TRAINING_CATEGORIES = ['Other', 'HEAVY EQUIPMENT RELATED'];
    const TRAINING_TYPES = ['Union Bootcamp', 'Osha', 'First Aid', 'Veriforce', 'Trenching and Excavating', 'Additional Training', 'CPR/First Aid'];
    const TRAINING_FREQUENCIES = ['N/A', 'None', 'Once', 'One Time', 'W/R', 'Annually', 'Bi-Annually', 'Every 3 Years', 'Every 5 Years', 'As Needed'];
    const TRAINING_STATUSES = ['Pending', 'In Progress', 'Completed', 'Expired', 'Renewed'];

    // Normalize any date string to YYYY-MM-DD for <input type="date">
    const toDateInputValue = (val: string | undefined) => {
        if (!val) return '';
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        // MM/DD/YYYY
        const mdyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
        // ISO string like 2025-01-01T00:00:00.000Z
        if (val.includes('T')) return val.split('T')[0];
        return val;
    };

    // Format date for table display as MM/DD/YYYY
    const formatDateDisplay = (val: string | undefined) => {
        if (!val) return '-';
        const iso = toDateInputValue(val);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            const [y, m, d] = iso.split('-');
            return `${m}/${d}/${y}`;
        }
        return val || '-';
    };

    // Open base64 data URIs as blob URLs (direct href to data: causes about:blank)
    const openFileUrl = (fileUrl: string) => {
        if (!fileUrl) return;
        if (fileUrl.startsWith('http')) {
            window.open(fileUrl, '_blank');
            return;
        }
        // Handle base64 data URI
        try {
            const [header, base64] = fileUrl.split(',');
            const mimeMatch = header.match(/data:([^;]+)/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Error opening file:', e);
            toastError('Could not open file');
        }
    };

    const handleDeleteTrainingRecord = async (index: number) => {
        if (!employee) return;
        setSavingTraining(true);
        try {
            const updated = [...(employee.trainingCertifications || [])];
            updated.splice(index, 1);
            const res = await apiCall('updateEmployee', { id: employee._id, item: { trainingCertifications: updated } });
            if (res.success) {
                setEmployee({ ...employee, trainingCertifications: updated });
                success('Record deleted');
                setDeletingTrainingIdx(null);
            } else {
                toastError('Failed to delete record');
            }
        } catch (e) {
            toastError('Error deleting record');
        } finally {
            setSavingTraining(false);
        }
    };

    const handleSaveTrainingEdit = async () => {
        if (!employee || editingTrainingIdx === null || !editingTraining) return;
        setSavingTraining(true);
        try {
            const updated = [...(employee.trainingCertifications || [])];
            updated[editingTrainingIdx] = editingTraining;
            const res = await apiCall('updateEmployee', { id: employee._id, item: { trainingCertifications: updated } });
            if (res.success) {
                setEmployee({ ...employee, trainingCertifications: updated });
                success('Record updated');
                setEditingTrainingIdx(null);
                setEditingTraining(null);
            } else {
                toastError('Failed to update record');
            }
        } catch (e) {
            toastError('Error updating record');
        } finally {
            setSavingTraining(false);
        }
    };

    const handleAddTrainingRecord = async () => {
        if (!employee) return;
        if (!newTraining.type && !newTraining.category) {
            toastError('Please select at least a category or type');
            return;
        }
        setSavingTraining(true);
        try {
            const record = { ...newTraining, createdAt: new Date().toISOString() };
            const updated = [...(employee.trainingCertifications || []), record];
            const res = await apiCall('updateEmployee', { id: employee._id, item: { trainingCertifications: updated } });
            if (res.success) {
                setEmployee({ ...employee, trainingCertifications: updated });
                success('Record added');
                setNewTraining({ ...emptyTraining });
                setIsAddingTraining(false);
            } else {
                toastError('Failed to add record');
            }
        } catch (e) {
            toastError('Error adding record');
        } finally {
            setSavingTraining(false);
        }
    };

    const handleAddDocument = async () => {
        if (!employee) return;
        if (!newDocument.type && !newDocument.description) {
            toastError('Please enter at least a type or description');
            return;
        }
        setSavingDocument(true);
        try {
            const record = { ...newDocument, date: newDocument.date || new Date().toISOString().split('T')[0] };
            const updated = [...(employee.documents || []), record];
            const res = await apiCall('updateEmployee', { id: employee._id, item: { documents: updated } });
            if (res.success) {
                setEmployee({ ...employee, documents: updated });
                success('Document added');
                setNewDocument({ ...emptyDocument });
                setIsAddingDocument(false);
            } else {
                toastError('Failed to add document');
            }
        } catch (e) {
            toastError('Error adding document');
        } finally {
            setSavingDocument(false);
        }
    };

    const handleAddDrugTest = async () => {
        if (!employee) return;
        if (!newDrugTest.type && !newDrugTest.description) {
            toastError('Please enter at least a type or description');
            return;
        }
        setSavingDrugTest(true);
        try {
            const record = { ...newDrugTest, date: newDrugTest.date || new Date().toISOString().split('T')[0] };
            const updated = [...(employee.drugTestingRecords || []), record];
            const res = await apiCall('updateEmployee', { id: employee._id, item: { drugTestingRecords: updated } });
            if (res.success) {
                setEmployee({ ...employee, drugTestingRecords: updated });
                success('Drug test record added');
                setNewDrugTest({ ...emptyDrugTest });
                setIsAddingDrugTest(false);
            } else {
                toastError('Failed to add record');
            }
        } catch (e) {
            toastError('Error adding record');
        } finally {
            setSavingDrugTest(false);
        }
    };

    // Dropdown options for edit modal
    const [appRoleOptions, setAppRoleOptions] = useState<string[]>([]);
    const [positionOptions, setPositionOptions] = useState<string[]>([]);
    const [designationOptions, setDesignationOptions] = useState<string[]>([]);
    const [cityOptions, setCityOptions] = useState<string[]>([]);
    const [stateOptions, setStateOptions] = useState<string[]>([]);

    // API Call Helper
    const apiCall = async (action: string, payload: Record<string, unknown> = {}) => {
        const res = await fetch('/api/webhook/devcoBackend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        return res.json();
    };

    const loadEmployee = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiCall('getEmployeeById', { id });
            if (res.success && res.result) {
                setEmployee(res.result);
                // Trigger animation on load
                setTimeout(() => setAnimate(true), 100);
            } else {
                toastError('Failed to load employee');
                router.push('/employees');
            }
        } catch (err) {
            console.error('Error loading employee:', err);
            toastError('Error loading employee');
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        if (id) {
            loadEmployee();
            fetchOptions();
        }
    }, [id]);

    const fetchOptions = async () => {
        try {
            const res = await apiCall('getEmployees', { includeInactive: true });
            if (res.success && res.result) {
                const emps: Employee[] = res.result;
                const getUnique = (key: keyof Employee) => Array.from(new Set(emps.map(e => e[key]).filter(Boolean))) as string[];
                setAppRoleOptions(getUnique('appRole'));
                setPositionOptions(getUnique('companyPosition'));
                setDesignationOptions(getUnique('designation'));
                setCityOptions(getUnique('city'));
                setStateOptions(getUnique('state'));
            }
        } catch (err) {
            console.error('Error fetching options:', err);
        }
    };

    const handleEditEmployee = () => {
        if (!employee) return;
        setCurrentEmployee({ ...employee });
        setModalTab('personal');
        setIsEditModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentEmployee.firstName || !currentEmployee.lastName || !currentEmployee.email) {
            toastError('First Name, Last Name and Email are required');
            return;
        }

        setSaving(true);
        try {
            const res = await apiCall('updateEmployee', { id: currentEmployee._id, item: currentEmployee });
            if (res.success) {
                success('Employee updated successfully');
                setIsEditModalOpen(false);
                loadEmployee(true);
            } else {
                toastError('Failed to save employee: ' + (res.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving employee:', err);
            toastError('An error occurred while saving');
        } finally {
            setSaving(false);
        }
    };

    const handleQuickUpdate = async (field: string, value: any) => {
        if (!employee) return;
        
        // Optimistic update
        const originalEmployee = { ...employee };
        setEmployee({ ...employee, [field]: value });

        try {
            const res = await apiCall('updateEmployee', { id: employee._id, item: { [field]: value } });
            if (res.success) {
                success('Updated successfully');
            } else {
                toastError('Update failed');
                setEmployee(originalEmployee); // Revert
            }
        } catch (e) {
            console.error('Quick update error:', e);
            toastError('Update failed');
            setEmployee(originalEmployee); // Revert
        }
    };

    const getComplianceOptions = (key: string) => {
        return ['Yes', 'No', 'Pending', 'N/A'];
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

    const handleToggle = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleDelete = async () => {
        if (!employee) return;
        try {
            const res = await apiCall('deleteEmployee', { id: employee._id });
            if (res.success) {
                success('Employee deleted successfully');
                router.push('/employees');
            } else {
                toastError('Failed to delete employee');
            }
        } catch (err) {
            toastError('Error deleting employee');
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="flex-1 p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium">Loading Employee Profile...</p>
                    </div>
                </div>
            </>
        );
    }

    if (!employee) return null; // Should redirect in loadEmployee

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            <div className="flex-none bg-white">
            <Header
                leftContent={
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => canViewEmployees ? router.push('/employees') : router.push('/')}
                                className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Back to List</p>
                        </TooltipContent>
                    </Tooltip>
                }
                rightContent={null}
            />
            </div>

            <main className="flex-1 overflow-y-auto">
                <div className="w-full p-4 pb-24 max-w-[1600px] mx-auto">

                    {/* Hero Header Card */}
                    <EmployeeHeaderCard
                        employee={employee}
                        onUpdate={handleQuickUpdate}
                        onEditSignature={() => setIsSignatureModalOpen(true)}
                        animate={animate}
                    />

                    {/* Accordions Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                        {/* Personal Info */}
                        <AccordionCard
                            title="Personal Information"
                            icon={User}
                            isOpen={openSections['personal']}
                            onToggle={() => handleToggle('personal')}
                        >
                            <DetailRow label="DOB" value={employee.dob} />
                            <DetailRow label="Address" value={employee.address} />
                            <DetailRow label="City" value={employee.city} />
                            <DetailRow label="State" value={employee.state} />
                            <DetailRow label="Zip Code" value={employee.zip} />
                            <DetailRow label="Driver License" value={employee.driverLicense} />
                        </AccordionCard>

                        {/* Employment Details */}
                        <AccordionCard
                            title="Employment Details"
                            icon={Briefcase}
                            isOpen={openSections['employment']}
                            onToggle={() => handleToggle('employment')}
                        >
                            <DetailRow label="Date Hired" value={employee.dateHired} />
                            <DetailRow label="App Role" value={employee.appRole} />
                            <DetailRow label="Company Position" value={employee.companyPosition} />
                            <DetailRow label="Designation" value={employee.designation} />
                            <DetailRow label="Group No." value={employee.groupNo} />
                            <DetailRow label="Separation Date" value={employee.separationDate} />
                            <DetailRow label="Separation Reason" value={employee.separationReason} />
                        </AccordionCard>

                        {/* Compliance & Documents */}
                        <div className="col-span-1 xl:col-span-2">
                            <AccordionCard
                                title="Compliance & Documents"
                                icon={FileText}
                                isOpen={openSections['compliance']}
                                onToggle={() => handleToggle('compliance')}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <div>
                                        <DetailRow label="Application / Resume" value={employee.applicationResume} isLink href={employee.applicationResume} />
                                        <DetailRow label="Employee Handbook" value={employee.employeeHandbook} isLink href={employee.employeeHandbook} />
                                        <DetailRow label="W4 / I9 / DD" value={employee.quickbooksW4I9DD} isLink href={employee.quickbooksW4I9DD} />
                                        <DetailRow label="Emergency Contact" value={employee.emergencyContact} isLink href={employee.emergencyContact} />
                                        <DetailRow label="DOT Release" value={employee.dotRelease} isLink href={employee.dotRelease} />
                                        <DetailRow label="DMV Pull Notice" value={employee.dmvPullNotifications} isLink href={employee.dmvPullNotifications} />
                                        <DetailRow label="Driving Record Permission" value={employee.drivingRecordPermission} isLink href={employee.drivingRecordPermission} />
                                    </div>
                                    <div>
                                        <DetailRow label="Background Check" value={employee.backgroundCheck} isLink href={employee.backgroundCheck} />
                                        <DetailRow label="Copy of DL" value={employee.copyOfDL} isLink href={employee.copyOfDL} />
                                        <DetailRow label="Copy of SS" value={employee.copyOfSS} isLink href={employee.copyOfSS} />
                                        <DetailRow label="LCP Tracker" value={employee.lcpTracker} isLink href={employee.lcpTracker} />
                                        <DetailRow label="EDD" value={employee.edd} isLink href={employee.edd} />
                                        <DetailRow label="Auto Insurance" value={employee.autoInsurance} isLink href={employee.autoInsurance} />
                                        <DetailRow label="Veriforce / OQ" value={employee.veriforce} isLink href={employee.veriforce} />
                                        <DetailRow label="Union Paperwork" value={employee.unionPaperwork1184} isLink href={employee.unionPaperwork1184} />
                                    </div>
                                </div>
                            </AccordionCard>
                        </div>

                        {/* Documents */}
                            <div className="col-span-1 xl:col-span-2">
                                <AccordionCard
                                    title={`Documents (${employee.documents?.length || 0})`}
                                    icon={FileText}
                                    isOpen={openSections['documents']}
                                    onToggle={() => handleToggle('documents')}
                                    action={
                                        <button
                                            onClick={() => { setIsAddingDocument(true); setOpenSections(prev => ({ ...prev, documents: true })); }}
                                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                            title="Add Document"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    }
                                >
                                    {/* Add Document Form */}
                                    {isAddingDocument && (
                                        <div className="mb-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Add New Document</h4>
                                                <button onClick={() => { setIsAddingDocument(false); setNewDocument({ ...emptyDocument }); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                                                    <Input type="date" value={toDateInputValue(newDocument.date)} onChange={e => setNewDocument({ ...newDocument, date: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Input placeholder="e.g. ID, Contract" value={newDocument.type || ''} onChange={e => setNewDocument({ ...newDocument, type: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newDocument.description || ''} onChange={e => setNewDocument({ ...newDocument, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document</label>
                                                    <div className="flex items-center gap-3">
                                                        {newDocument.fileUrl && <span className="text-xs text-emerald-600 font-medium">File attached ✓</span>}
                                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F4C75] hover:bg-blue-50/30 transition-all text-slate-600">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            {newDocument.fileUrl ? 'Replace File' : 'Upload File'}
                                                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setNewDocument({ ...newDocument, fileUrl: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                        </label>
                                                        {newDocument.fileUrl && (
                                                            <button type="button" onClick={() => setNewDocument({ ...newDocument, fileUrl: '' })} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddDocument} disabled={savingDocument}>
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> {savingDocument ? 'Adding...' : 'Add Document'}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setIsAddingDocument(false); setNewDocument({ ...emptyDocument }); }}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {(employee.documents?.length ?? 0) > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100">
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">File</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employee.documents?.map((doc: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                        <td className="py-2 px-3 text-slate-600">{formatDateDisplay(doc.date)}</td>
                                                        <td className="py-2 px-3 text-slate-800 font-medium">{doc.type || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{doc.description || '-'}</td>
                                                        <td className="py-2 px-3">{doc.fileUrl ? <button onClick={() => openFileUrl(doc.fileUrl)} className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium hover:bg-emerald-100 transition-colors cursor-pointer">View File</button> : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-slate-400 italic">No documents uploaded yet</div>
                                    )}
                                </AccordionCard>
                            </div>

                        {/* Drug Testing Records */}
                            <div className="col-span-1 xl:col-span-2">
                                <AccordionCard
                                    title={`Drug Testing Records (${employee.drugTestingRecords?.length || 0})`}
                                    icon={FlaskConical}
                                    isOpen={openSections['drugTesting']}
                                    onToggle={() => handleToggle('drugTesting')}
                                    action={
                                        <button
                                            onClick={() => { setIsAddingDrugTest(true); setOpenSections(prev => ({ ...prev, drugTesting: true })); }}
                                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                            title="Add Drug Test Record"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    }
                                >
                                    {/* Add Drug Test Form */}
                                    {isAddingDrugTest && (
                                        <div className="mb-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Add New Drug Test Record</h4>
                                                <button onClick={() => { setIsAddingDrugTest(false); setNewDrugTest({ ...emptyDrugTest }); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                                                    <Input type="date" value={toDateInputValue(newDrugTest.date)} onChange={e => setNewDrugTest({ ...newDrugTest, date: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Input placeholder="e.g. Random, Pre-Employment" value={newDrugTest.type || ''} onChange={e => setNewDrugTest({ ...newDrugTest, type: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newDrugTest.description || ''} onChange={e => setNewDrugTest({ ...newDrugTest, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document</label>
                                                    <div className="flex items-center gap-3">
                                                        {newDrugTest.fileUrl && <span className="text-xs text-emerald-600 font-medium">File attached ✓</span>}
                                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F4C75] hover:bg-blue-50/30 transition-all text-slate-600">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            {newDrugTest.fileUrl ? 'Replace File' : 'Upload File'}
                                                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setNewDrugTest({ ...newDrugTest, fileUrl: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                        </label>
                                                        {newDrugTest.fileUrl && (
                                                            <button type="button" onClick={() => setNewDrugTest({ ...newDrugTest, fileUrl: '' })} className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddDrugTest} disabled={savingDrugTest}>
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> {savingDrugTest ? 'Adding...' : 'Add Record'}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setIsAddingDrugTest(false); setNewDrugTest({ ...emptyDrugTest }); }}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {(employee.drugTestingRecords?.length ?? 0) > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100">
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">File</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employee.drugTestingRecords?.map((rec: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                        <td className="py-2 px-3 text-slate-600">{formatDateDisplay(rec.date)}</td>
                                                        <td className="py-2 px-3 text-slate-800 font-medium">{rec.type || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{rec.description || '-'}</td>
                                                        <td className="py-2 px-3">{rec.fileUrl ? <button onClick={() => openFileUrl(rec.fileUrl)} className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium hover:bg-emerald-100 transition-colors cursor-pointer">View File</button> : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-slate-400 italic">No drug testing records yet</div>
                                    )}
                                </AccordionCard>
                            </div>

                        {/* Training & Certifications */}
                            <div className="col-span-1 xl:col-span-2">
                                <AccordionCard
                                    title={`Training & Certifications (${employee.trainingCertifications?.length || 0})`}
                                    icon={GraduationCap}
                                    isOpen={openSections['training']}
                                    onToggle={() => handleToggle('training')}
                                    action={
                                        <button
                                            onClick={() => { setIsAddingTraining(true); setOpenSections(prev => ({ ...prev, training: true })); }}
                                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                            title="Add Training / Certification"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    }
                                >
                                    {/* Inline Edit Form */}
                                    {editingTrainingIdx !== null && editingTraining && (
                                        <div className="mb-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Edit Record #{editingTrainingIdx + 1}</h4>
                                                <button onClick={() => { setEditingTrainingIdx(null); setEditingTraining(null); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                                    <Select onValueChange={val => setEditingTraining({ ...editingTraining, category: val })} value={editingTraining.category || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Select onValueChange={val => setEditingTraining({ ...editingTraining, type: val })} value={editingTraining.type || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                                                    <Select onValueChange={val => setEditingTraining({ ...editingTraining, frequency: val })} value={editingTraining.frequency || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Date</label>
                                                    <Input type="date" value={toDateInputValue(editingTraining.assignedDate)} onChange={e => setEditingTraining({ ...editingTraining, assignedDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Completion Date</label>
                                                    <Input type="date" value={toDateInputValue(editingTraining.completionDate)} onChange={e => setEditingTraining({ ...editingTraining, completionDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Renewal Date</label>
                                                    <Input type="date" value={toDateInputValue(editingTraining.renewalDate)} onChange={e => setEditingTraining({ ...editingTraining, renewalDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                                    <Select onValueChange={val => setEditingTraining({ ...editingTraining, status: val })} value={editingTraining.status || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={editingTraining.description || ''} onChange={e => setEditingTraining({ ...editingTraining, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document</label>
                                                    <div className="flex items-center gap-3">
                                                        {editingTraining.fileUrl && (
                                                            <button type="button" onClick={() => openFileUrl(editingTraining.fileUrl)} className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1">
                                                                <FileText className="w-3.5 h-3.5" /> Current File
                                                            </button>
                                                        )}
                                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F4C75] hover:bg-blue-50/30 transition-all text-slate-600">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            {editingTraining.fileUrl ? 'Replace File' : 'Upload File'}
                                                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setEditingTraining({ ...editingTraining, fileUrl: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                        </label>
                                                        {editingTraining.fileUrl && (
                                                            <button type="button" onClick={() => setEditingTraining({ ...editingTraining, fileUrl: '' })} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Button size="sm" className="bg-[#0F4C75] hover:bg-[#0b3c5e] text-white" onClick={handleSaveTrainingEdit} disabled={savingTraining}>
                                                    <Check className="w-3.5 h-3.5 mr-1" /> {savingTraining ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setEditingTrainingIdx(null); setEditingTraining(null); }}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Add New Record Form */}
                                    {isAddingTraining && (
                                        <div className="mb-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Add New Training / Certification</h4>
                                                <button onClick={() => { setIsAddingTraining(false); setNewTraining({ ...emptyTraining }); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, category: val })} value={newTraining.category || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, type: val })} value={newTraining.type || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, frequency: val })} value={newTraining.frequency || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Date</label>
                                                    <Input type="date" value={toDateInputValue(newTraining.assignedDate)} onChange={e => setNewTraining({ ...newTraining, assignedDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Completion Date</label>
                                                    <Input type="date" value={toDateInputValue(newTraining.completionDate)} onChange={e => setNewTraining({ ...newTraining, completionDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Renewal Date</label>
                                                    <Input type="date" value={toDateInputValue(newTraining.renewalDate)} onChange={e => setNewTraining({ ...newTraining, renewalDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, status: val })} value={newTraining.status || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newTraining.description || ''} onChange={e => setNewTraining({ ...newTraining, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document</label>
                                                    <div className="flex items-center gap-3">
                                                        {newTraining.fileUrl && (
                                                            <span className="text-xs text-emerald-600 font-medium">File attached ✓</span>
                                                        )}
                                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F4C75] hover:bg-blue-50/30 transition-all text-slate-600">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            {newTraining.fileUrl ? 'Replace File' : 'Upload File'}
                                                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setNewTraining({ ...newTraining, fileUrl: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                        </label>
                                                        {newTraining.fileUrl && (
                                                            <button type="button" onClick={() => setNewTraining({ ...newTraining, fileUrl: '' })} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddTrainingRecord} disabled={savingTraining}>
                                                    <Plus className="w-3.5 h-3.5 mr-1" /> {savingTraining ? 'Adding...' : 'Add Record'}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setIsAddingTraining(false); setNewTraining({ ...emptyTraining }); }}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}


                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100">
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Frequency</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Assigned</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Completed</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Renewal</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">File</th>
                                                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase w-20">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employee.trainingCertifications?.map((rec: any, i: number) => (
                                                    <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/50 ${editingTrainingIdx === i ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="py-2 px-3 text-slate-600">{rec.category || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-800 font-medium">{rec.type || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{rec.frequency || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{formatDateDisplay(rec.assignedDate)}</td>
                                                        <td className="py-2 px-3 text-slate-600">{formatDateDisplay(rec.completionDate)}</td>
                                                        <td className="py-2 px-3 text-slate-600">{formatDateDisplay(rec.renewalDate)}</td>
                                                        <td className="py-2 px-3 text-slate-600">{rec.description || '-'}</td>
                                                        <td className="py-2 px-3">
                                                            {rec.status ? (
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rec.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : rec.status === 'Expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{rec.status}</span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {rec.fileUrl ? (
                                                                <button onClick={() => openFileUrl(rec.fileUrl)} className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium hover:bg-emerald-100 transition-colors cursor-pointer">
                                                                    View File
                                                                </button>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-2 px-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => { setEditingTrainingIdx(i); setEditingTraining({ ...rec }); }}
                                                                    className="p-1.5 text-slate-400 hover:text-[#0F4C75] hover:bg-blue-50 rounded-md transition-colors"
                                                                    title="Edit record"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                {deletingTrainingIdx === i ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleDeleteTrainingRecord(i)}
                                                                            className="p-1 text-xs bg-red-500 text-white rounded px-2 hover:bg-red-600 transition-colors"
                                                                            disabled={savingTraining}
                                                                        >
                                                                            {savingTraining ? '...' : 'Yes'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeletingTrainingIdx(null)}
                                                                            className="p-1 text-xs bg-slate-200 text-slate-600 rounded px-2 hover:bg-slate-300 transition-colors"
                                                                        >
                                                                            No
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setDeletingTrainingIdx(i)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                                        title="Delete record"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </AccordionCard>
                            </div>
                    </div>

                </div>
            </main>

            {/* Signature Modal */}
            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title="Update Signature"
                footer={null}
            >
                <div className="flex justify-center p-4">
                    <SignaturePad
                        value={employee?.signature}
                        onChange={(sig) => {
                            handleQuickUpdate('signature', sig);
                            setIsSignatureModalOpen(false);
                        }}
                        label={`Signature for ${employee?.firstName}`}
                    />
                </div>
            </Modal>

            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title="Delete Employee"
                message="Are you sure you want to delete this employee? This action cannot be undone."
                confirmText="Delete"
            />

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Employee"
                footer={
                    <>
                        <CancelButton onClick={() => setIsEditModalOpen(false)} />
                        <SaveButton onClick={handleSave} loading={saving} />
                    </>
                }
            >
                <div className="mb-4 md:mb-6">
                    <UnderlineTabs
                        tabs={[
                            { id: 'personal', label: 'Personal Info' },
                            { id: 'employment', label: 'Employment Details' },
                            { id: 'compliance', label: 'Files & Compliance' }
                        ]}
                        activeTab={modalTab}
                        onChange={setModalTab}
                    />
                </div>

                <div className="pb-2 md:pb-4">
                    {modalTab === 'personal' && (
                        <div className="grid grid-cols-12 gap-3 md:gap-4">
                            {/* Profile Picture and Signature Row */}
                            <div className="col-span-12 flex flex-wrap items-start justify-center gap-8 mb-3 md:mb-4">
                                {/* Profile Picture Upload */}
                                <div className="flex flex-col items-center">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
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
                                    <span className="text-xs text-gray-500 mt-2">Click to upload</span>
                                </div>

                                {/* Signature Pad */}
                                <SignaturePad
                                    value={currentEmployee.signature}
                                    onChange={(sig) => setCurrentEmployee({ ...currentEmployee, signature: sig })}
                                />
                            </div>


                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                <Input
                                    value={currentEmployee.firstName || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, firstName: e.target.value })}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                                <Input
                                    value={currentEmployee.recordId || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, recordId: e.target.value })}
                                    placeholder="EMP-001"
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
                                    disabled={true}
                                />
                                <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
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
                                <SearchableSelect
                                    label="City"
                                    value={currentEmployee.city || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, city: val })}
                                    options={cityOptions}
                                    placeholder="Select or type city..."
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <SearchableSelect
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
                        <div className="grid grid-cols-12 gap-3 md:gap-4">
                            <div className="col-span-12 md:col-span-6">
                                <SearchableSelect
                                    label="App Role"
                                    value={currentEmployee.appRole || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, appRole: val })}
                                    options={appRoleOptions}
                                />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <SearchableSelect
                                    label="Company Position"
                                    value={currentEmployee.companyPosition || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, companyPosition: val })}
                                    options={positionOptions}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-4">
                                <SearchableSelect
                                    label="Designation"
                                    value={currentEmployee.designation || ''}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, designation: val })}
                                    options={designationOptions}
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
                                <SearchableSelect
                                    label="Status"
                                    value={currentEmployee.status || 'Active'}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, status: val })}
                                    options={['Active', 'Inactive', 'Terminated']}
                                />
                            </div>

                            <div className="col-span-12 md:col-span-6">
                                <SearchableSelect
                                    label="Schedule Active"
                                    value={currentEmployee.isScheduleActive ? 'Yes' : 'No'}
                                    onChange={(val) => setCurrentEmployee({ ...currentEmployee, isScheduleActive: val === 'Yes' })}
                                    options={['Yes', 'No']}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
                                    <SearchableSelect
                                        label={field.label}
                                        value={(currentEmployee as any)[field.key] || ''}
                                        onChange={(val) => setCurrentEmployee({ ...currentEmployee, [field.key]: val })}
                                        options={getComplianceOptions(field.key)}
                                        placeholder="Select status..."
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>


        </div>
    );
}
