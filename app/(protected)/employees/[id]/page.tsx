'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, Trash2, ArrowLeft, Briefcase, FileText, User, Pencil } from 'lucide-react';
import { Header, Button, ConfirmModal, Modal, Input, SearchableSelect, UnderlineTabs, SaveButton, CancelButton } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { EmployeeHeaderCard, AccordionCard, DetailRow } from './components';

// Types (Mirrors Employee Interface)
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

    [key: string]: any;
}

export default function EmployeeViewPage() {
    const router = useRouter();
    const params = useParams();
    const id = decodeURIComponent(params.id as string);
    const { success, error: toastError } = useToast();

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
            const res = await apiCall('getEmployees');
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
        <>
            <Header
                leftContent={
                    <button
                        onClick={() => router.push('/employees')}
                        className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Back to List"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleEditEmployee}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-[#0F4C75] hover:bg-slate-100 rounded-xl transition-colors"
                            title="Edit Employee"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Employee"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto bg-gray-50/50">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-[1600px] mx-auto">

                    {/* Hero Header Card */}
                    <EmployeeHeaderCard
                        employee={employee}
                        onUpdate={() => { }}
                        animate={animate}
                    />

                    {/* Accordions Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

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
                    </div>

                </div>
            </main>

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
                            {/* Profile Picture Upload */}
                            <div className="col-span-12 flex flex-col items-center justify-center mb-3 md:mb-4">
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


        </>
    );
}
