'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, RefreshCw, Trash2, ArrowLeft, Briefcase, FileText, User } from 'lucide-react';
import { Header, Button, ConfirmModal } from '@/components/ui';
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
        }
    }, [id]);

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
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/employees')}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Back to List"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1" />

                        <button
                            onClick={() => loadEmployee(true)}
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className="w-5 h-5" />
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
        </>
    );
}
