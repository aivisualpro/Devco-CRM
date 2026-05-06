'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, Trash2, ArrowLeft, Briefcase, FileText, User, Pencil, FlaskConical, GraduationCap, X, Check, Plus, Upload, ChevronLeft, ChevronRight, Loader2, Search, Eye } from 'lucide-react';
import { Header, Button, ConfirmModal, Modal, Input, SearchableSelect, UnderlineTabs, SaveButton, CancelButton, Tooltip, TooltipTrigger, TooltipContent, Switch } from '@/components/ui';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useToast } from '@/hooks/useToast';
import { EmployeeHeaderCard, AccordionCard, DetailRow } from './components';
import { PageSkeleton } from './loading';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Employee Performance Score Component ──────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: { label: string; color: string } }) {
    const R = 54, C = 2 * Math.PI * R;
    const offset = C - (score / 100) * C;
    const colorMap: Record<string, string> = { emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', red: '#ef4444' };
    const stroke = colorMap[grade.color] || '#3b82f6';
    const textColor: Record<string, string> = { emerald: 'text-emerald-600', blue: 'text-blue-600', amber: 'text-amber-500', red: 'text-red-500' };
    return (
        <div className="relative flex items-center justify-center w-36 h-36">
            <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
                <circle cx="72" cy="72" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle cx="72" cy="72" r={R} fill="none" stroke={stroke} strokeWidth="10"
                    strokeDasharray={C} strokeDashoffset={offset}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${textColor[grade.color]}`}>{score}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{grade.label}</span>
            </div>
        </div>
    );
}

function SubScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-400', violet: 'bg-violet-500', rose: 'bg-rose-500' };
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>{label}</span><span className="text-slate-700">{Math.round(value)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${colorMap[color]}`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function PerfKpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'blue' }) {
    const cls = highlight === 'green' ? 'text-emerald-600' : highlight === 'red' ? 'text-red-500' : highlight === 'blue' ? 'text-blue-600' : 'text-slate-800';
    return (
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm space-y-0.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`text-lg font-black ${cls}`}>{value}</p>
            {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
        </div>
    );
}

function fmt(n: number) {
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(2)}M` : a >= 1000 ? `${s}$${(a / 1000).toFixed(1)}k` : `${s}$${Math.round(a)}`;
}

function EmployeePerformanceSection({ writerName, employeeEmail }: { writerName: string; employeeEmail: string }) {
    const [data, setData] = (useState as any)(null);
    const [loading, setLoading] = (useState as any)(true);

    useEffect(() => {
        if (!writerName) return;
        setLoading(true);
        fetch(`/api/employees/performance?writerEmail=${encodeURIComponent(employeeEmail)}&writerName=${encodeURIComponent(writerName)}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [writerName]);

    if (loading) return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-6 mb-6 animate-pulse">
            <div className="h-6 w-48 bg-slate-200 rounded-lg mb-4" />
            <div className="grid grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
            </div>
        </div>
    );

    if (!data || (!data.isWriter && !data.isPM)) return null;

    const { performanceScore, grade, kpis, topProjects, lossProjects, projectCount } = data;
    const isWriter = data.isWriter;
    const isPM = data.isPM;
    const sched = data.schedules || {};
    const gradeBg: Record<string, string> = { emerald: 'bg-emerald-50 border-emerald-200', blue: 'bg-blue-50 border-blue-200', amber: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200' };

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4 px-1 flex-wrap">
                <div className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Performance Score</h3>
                {isPM && <span className="text-[10px] font-bold text-slate-400 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">{sched.total} schedules as PM</span>}
                {isWriter && <span className="text-[10px] font-bold text-slate-400 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">{projectCount} projects as writer</span>}
            </div>

            <div className={`grid grid-cols-1 ${isWriter ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4`}>

                {/* Score gauge + sub-scores */}
                <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-5 border ${gradeBg[grade.color]}`}>
                    <ScoreRing score={performanceScore} grade={grade} />
                    <div className="w-full space-y-2.5">
                        {isPM && (
                            <>
                                <SubScoreBar label="JHA Compliance"  value={sched.jhaRate || 0}  color="emerald" />
                                <SubScoreBar label="DJT Compliance"  value={sched.djtRate || 0}  color="blue" />
                                <SubScoreBar label="Both (JHA+DJT)"  value={sched.bothRate || 0} color="violet" />
                            </>
                        )}
                        {isWriter && (
                            <>
                                <SubScoreBar label="Margin Quality"  value={Math.min(100, Math.max(0, (kpis?.marginPct || 0) * 2.5))}  color="amber" />
                                <SubScoreBar label="Collection Rate" value={Math.min(100, Math.max(0, kpis?.collectedPct || 0))}        color="rose" />
                            </>
                        )}
                    </div>
                </div>

                {/* PM compliance stats + schedule breakdown */}
                {isPM && (
                    <div className="flex flex-col gap-2.5">
                        {/* Big stat cards */}
                        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">JHA Completed</p>
                                    <p className="text-2xl font-black text-emerald-600">{sched.withJHA}<span className="text-sm text-slate-400 font-bold ml-1">/ {sched.total}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-black ${sched.jhaRate >= 80 ? 'text-emerald-600' : sched.jhaRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{sched.jhaRate}%</div>
                                </div>
                            </div>
                            <div className="h-1.5 bg-emerald-100 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${sched.jhaRate}%` }} />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-500">DJT Completed</p>
                                    <p className="text-2xl font-black text-blue-600">{sched.withDJT}<span className="text-sm text-slate-400 font-bold ml-1">/ {sched.total}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-black ${sched.djtRate >= 80 ? 'text-blue-600' : sched.djtRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{sched.djtRate}%</div>
                                </div>
                            </div>
                            <div className="h-1.5 bg-blue-100 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${sched.djtRate}%` }} />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-violet-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-wider text-violet-500">Both Completed</p>
                                    <p className="text-2xl font-black text-violet-600">{sched.withBoth}<span className="text-sm text-slate-400 font-bold ml-1">/ {sched.total}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-black ${sched.bothRate >= 80 ? 'text-violet-600' : sched.bothRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{sched.bothRate}%</div>
                                </div>
                            </div>
                            <div className="h-1.5 bg-violet-100 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all duration-700" style={{ width: `${sched.bothRate}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Financial KPIs — only if writer */}
                {isWriter && kpis && (
                    <div className={`${isPM ? '' : 'xl:col-span-1'} grid grid-cols-3 gap-2.5 content-start`}>
                        <PerfKpi label="Revenue"        value={fmt(kpis.income)}          sub={`from ${projectCount} projects`} highlight="blue" />
                        <PerfKpi label="Total Cost"      value={fmt(kpis.totalCost)}       sub={kpis.income > 0 ? `${((kpis.totalCost/kpis.income)*100).toFixed(0)}% of rev` : ''} />
                        <PerfKpi label="Gross Profit"    value={fmt(kpis.profit)}          highlight={kpis.profit >= 0 ? 'green' : 'red'} />
                        <PerfKpi label="Gross Margin"    value={`${kpis.marginPct.toFixed(1)}%`} highlight={kpis.marginPct >= 20 ? 'green' : kpis.marginPct >= 10 ? undefined : 'red'} />
                        <PerfKpi label="Contract Value"  value={fmt(kpis.contractValue)}   sub="orig + change orders" />
                        <PerfKpi label="Backlog"         value={fmt(kpis.backlog)}          sub="remaining to bill" highlight="blue" />
                        <PerfKpi label="A/R Outstanding" value={fmt(kpis.arOutstanding)}   highlight={kpis.arOutstanding > 0 ? 'red' : 'green'} />
                        <PerfKpi label="Collected"       value={`${kpis.collectedPct.toFixed(0)}%`} sub={fmt(kpis.income - kpis.arOutstanding)} highlight="green" />
                        <PerfKpi label="DSO"             value={`${kpis.dso}d`}            highlight={kpis.dso > 60 ? 'red' : 'green'} />
                    </div>
                )}

                {/* Top & Loss projects — only if writer */}
                {isWriter && (
                    <div className="flex flex-col gap-3">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Top Projects</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {(topProjects || []).slice(0, 5).map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-700 truncate">{p.name || `Project ${i+1}`}</p>
                                            <p className="text-[9px] text-slate-400">{fmt(p.income)} rev</p>
                                        </div>
                                        <div className="text-right ml-2">
                                            <p className="text-[11px] font-black text-emerald-600">{fmt(p.profit)}</p>
                                            <p className="text-[9px] text-slate-400">{p.margin.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                ))}
                                {(!topProjects || topProjects.length === 0) && <p className="text-center text-[10px] text-slate-400 italic py-4">No projects yet</p>}
                            </div>
                        </div>

                        {lossProjects && lossProjects.length > 0 && (
                            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-100">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-red-700">Loss Projects</span>
                                    <span className="ml-auto text-[9px] font-bold text-red-400">{lossProjects.length} project{lossProjects.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {lossProjects.map((p: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-red-50/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-slate-700 truncate">{p.name}</p>
                                                <p className="text-[9px] text-slate-400">{fmt(p.income)} rev</p>
                                            </div>
                                            <div className="text-right ml-2">
                                                <p className="text-[11px] font-black text-red-500">{fmt(p.profit)}</p>
                                                <p className="text-[9px] text-red-400">{p.margin.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────


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

const SectionCard = ({ title, icon: Icon, children, action }: any) => (
    <div className="flex flex-col h-full min-h-[280px] bg-white/30 rounded-2xl shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] p-4 relative">
        <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-indigo-400" />}
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
            </div>
            {action && <div>{action}</div>}
        </div>
        <div className="p-0 flex-1">
            {children}
        </div>
    </div>
);

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

    // Accordion State for lower sections if needed
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'documents': true,
        'drugTesting': true
    });

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({});
    const [modalTab, setModalTab] = useState('personal');
    const [inlineEditSection, setInlineEditSection] = useState<'personal' | 'employment' | 'compliance' | null>(null);

    const [saving, setSaving] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const [isDrugModalOpen, setIsDrugModalOpen] = useState(false);
    const [drugSearch, setDrugSearch] = useState('');
    const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
    const [trainingSearch, setTrainingSearch] = useState('');

    // Document Modal State
    const emptyDocument = { fileName: '', fileUrl: '', files: [] as string[], createdAt: '' };
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [currentDocModal, setCurrentDocModal] = useState<any>({ ...emptyDocument });
    const [currentDocModalIdx, setCurrentDocModalIdx] = useState<number | null>(null);
    const [isViewOnlyDoc, setIsViewOnlyDoc] = useState(false);
    const [savingDocument, setSavingDocument] = useState(false);
    const [deletingDocIdx, setDeletingDocIdx] = useState<number | null>(null);
    const [docThumbIdx, setDocThumbIdx] = useState<Record<number, number>>({});
    const [activeDocCardIdx, setActiveDocCardIdx] = useState<number | null>(null);
    const [docSearch, setDocSearch] = useState('');

    const emptyDrugTest = { date: '', type: 'Drug / Alcohol Testing Auth', description: '', fileUrl: '', files: [] as string[] };
    const [currentDrugModal, setCurrentDrugModal] = useState<any>({ ...emptyDrugTest });
    const [currentDrugModalIdx, setCurrentDrugModalIdx] = useState<number | null>(null);
    const [isViewOnlyDrug, setIsViewOnlyDrug] = useState(false);
    const emptyTraining = { category: '', type: '', frequency: '', assignedDate: '', completionDate: '', renewalDate: '', status: '', description: '', fileUrl: '', files: [] as string[] };
    const [currentTrainingModal, setCurrentTrainingModal] = useState<any>({ ...emptyTraining });
    const [currentTrainingModalIdx, setCurrentTrainingModalIdx] = useState<number | null>(null);
    const [isViewOnlyTraining, setIsViewOnlyTraining] = useState(false);
    const [drugTestingThumbIdx, setDrugTestingThumbIdx] = useState<Record<number, number>>({});
    const [activeDrugCardIdx, setActiveDrugCardIdx] = useState<number | null>(null);
    const [savingTraining, setSavingTraining] = useState(false);
    const [deletingTrainingIdx, setDeletingTrainingIdx] = useState<number | null>(null);
    const [trainingThumbIdx, setTrainingThumbIdx] = useState<Record<number, number>>({});
    const [savingDrugTest, setSavingDrugTest] = useState(false);
    const [deletingDrugTestIdx, setDeletingDrugTestIdx] = useState<number | null>(null);

    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [isUploadingDrug, setIsUploadingDrug] = useState(false);
    const [isUploadingTraining, setIsUploadingTraining] = useState(false);

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

    // Open file URLs: supports http(s) URLs, relative paths (/api/docs/...), and base64 data URIs
    const openFileUrl = (fileUrl: string) => {
        if (!fileUrl) return;
        // HTTP(s) URLs or relative paths (e.g. /api/docs/...)
        if (fileUrl.startsWith('http') || fileUrl.startsWith('/')) {
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



    const handleDocModalSave = async () => {
        if (!employee) return;
        if (!currentDocModal.fileName) {
            toastError('Please enter a file name');
            return;
        }
        setSavingDocument(true);
        try {
            const updated = [...(employee.documents || [])];
            // Format for save, migrating legacy fileUrl into files if needed
            const recordToSave = {
                ...currentDocModal,
                date: currentDocModal.date || new Date().toISOString().split('T')[0],
            };

            if (currentDocModalIdx !== null) {
                updated[currentDocModalIdx] = recordToSave;
            } else {
                recordToSave.createdAt = new Date().toISOString();
                updated.push(recordToSave);
            }

            const res = await apiCall('updateEmployee', { id: employee._id, item: { documents: updated } });
            if (res.success) {
                setEmployee({ ...employee, documents: updated });
                success(`Document ${currentDocModalIdx !== null ? 'updated' : 'added'}`);
                setIsDocModalOpen(false);
            } else {
                toastError('Failed to save document');
            }
        } catch (e) {
            toastError('Error saving document');
        } finally {
            setSavingDocument(false);
        }
    };

    const handleDeleteDocument = async (index: number) => {
        if (!employee) return;
        setSavingDocument(true);
        try {
            const updated = [...(employee.documents || [])];
            updated.splice(index, 1);
            const res = await apiCall('updateEmployee', { id: employee._id, item: { documents: updated } });
            if (res.success) {
                setEmployee({ ...employee, documents: updated });
                success('Document deleted');
                setDeletingDocIdx(null);
            } else {
                toastError('Failed to delete document');
            }
        } catch (e) {
            toastError('Error deleting document');
        } finally {
            setSavingDocument(false);
        }
    };

    const getFileType = (url: string | undefined) => {
        if (!url) return { isImage: false, isPdf: false };
        const lowerUrl = url.toLowerCase();
        const isPdf = lowerUrl.includes('.pdf') || url.startsWith('data:application/pdf') || lowerUrl.includes('.pdf');
        const isImage = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp)(\?|#|$)/i.test(url) || (url.startsWith('/api/docs/') && !isPdf);
        return { isImage, isPdf };
    };

    const handleFileUpload = async (files: FileList | File[], onComplete: (urls: string[]) => void, folder = 'employees', setLoading?: (val: boolean) => void) => {
        if (setLoading) setLoading(true);
        const uploadedUrls: string[] = [];
        
        const fileArray = Array.from(files);
        
        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (data.success && data.url) {
                    uploadedUrls.push(data.url);
                } else {
                    toastError(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload error:', err);
                toastError(`Error uploading ${file.name}`);
            }
        }
        
        if (uploadedUrls.length > 0) {
            onComplete(uploadedUrls);
        }
        if (setLoading) setLoading(false);
    };


    const handleSaveDrugModal = async () => {
        if (!employee) return;
        if (!currentDrugModal.date) {
            toastError('Please select a date');
            return;
        }

        setSavingDrugTest(true);
        try {
            const currentRecords = [...(employee.drugTestingRecords || [])];
            const updatedRecord = {
                ...currentDrugModal,
                date: currentDrugModal.date || new Date().toISOString().split('T')[0],
            };

            let newRecords;
            if (currentDrugModalIdx !== null) {
                newRecords = currentRecords.map((r, i) => i === currentDrugModalIdx ? updatedRecord : r);
            } else {
                updatedRecord.createdAt = new Date().toISOString();
                newRecords = [updatedRecord, ...currentRecords];
            }

            const res = await apiCall('updateEmployee', { id: employee._id, item: { drugTestingRecords: newRecords } });

            if (res.success) {
                setEmployee({ ...employee, drugTestingRecords: newRecords });
                setIsDrugModalOpen(false);
                success(currentDrugModalIdx !== null ? 'Record updated' : 'Record added');
            } else {
                toastError('Failed to save record');
            }
        } catch (error) {
            console.error('Error saving drug test:', error);
            toastError('Failed to save record');
        } finally {
            setSavingDrugTest(false);
        }
    };



    const handleDeleteDrugTest = async (index: number) => {
        if (!employee) return;
        setSavingDrugTest(true);
        try {
            const updated = [...(employee.drugTestingRecords || [])];
            updated.splice(index, 1);
            const res = await apiCall('updateEmployee', { id: employee._id, item: { drugTestingRecords: updated } });
            if (res.success) {
                setEmployee({ ...employee, drugTestingRecords: updated });
                success('Record deleted');
                setDeletingDrugTestIdx(null);
            } else {
                toastError('Failed to delete record');
            }
        } catch (e) {
            toastError('Error deleting record');
        } finally {
            setSavingDrugTest(false);
        }
    };

    const handleSaveTrainingModal = async () => {
        if (!employee) return;
        if (!currentTrainingModal.category || !currentTrainingModal.type) {
            toastError('Category and Type are required');
            return;
        }

        setSavingTraining(true);
        try {
            const currentRecords = [...(employee.trainingCertifications || [])];
            
            // Format for save, migrating legacy fileUrl into files if needed
            const recordToSave = {
                ...currentTrainingModal,
                assignedDate: currentTrainingModal.assignedDate || null,
                completionDate: currentTrainingModal.completionDate || null,
                renewalDate: currentTrainingModal.renewalDate || null,
            };

            let updatedRecords;
            if (currentTrainingModalIdx !== null) {
                updatedRecords = currentRecords.map((r, i) => i === currentTrainingModalIdx ? recordToSave : r);
            } else {
                recordToSave.createdAt = new Date().toISOString();
                updatedRecords = [recordToSave, ...currentRecords];
            }

            const res = await apiCall('updateEmployee', { id: employee._id, item: { trainingCertifications: updatedRecords } });

            if (res.success) {
                setEmployee({ ...employee, trainingCertifications: updatedRecords });
                setIsTrainingModalOpen(false);
                success(currentTrainingModalIdx !== null ? 'Record updated' : 'Record added');
            } else {
                toastError('Failed to save record');
            }
        } catch (error) {
            console.error('Error saving training:', error);
            toastError('Failed to save record');
        } finally {
            setSavingTraining(false);
        }
    };

    const handleDeleteTraining = async (index: number) => {
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

    // Dropdown options for edit modal
    const [appRoleOptions, setAppRoleOptions] = useState<string[]>([]);
    const [positionOptions, setPositionOptions] = useState<string[]>([]);
    const [designationOptions, setDesignationOptions] = useState<string[]>([]);
    const [cityOptions, setCityOptions] = useState<string[]>([]);
    const [stateOptions, setStateOptions] = useState<string[]>([]);

    // API Call Helper
    const apiCall = async (action: string, payload: Record<string, any> = {}) => {
        try {
            let url = '';
            let method = 'POST';
            let body: any = payload;

            if (action === 'getEmployeeById') { url = `/api/employees/${payload.id}`; method = 'GET'; }
            else if (action === 'updateEmployee') { url = `/api/employees/${payload.id}`; method = 'PATCH'; body = payload.item; }
            else if (action === 'deleteEmployee') { url = `/api/employees/${payload.id}`; method = 'DELETE'; }
            else if (action === 'getEmployees') { url = '/api/employees'; method = 'GET'; }

            const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
            if (method !== 'GET') options.body = JSON.stringify(body);

            const res = await fetch(url, options);
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, error: String(err) };
        }
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
                setDesignationOptions([
                    'Project Manager',
                    'Foreman',
                    'Insured Driver'
                ]);
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

    const handleInlineSave = async () => {
        setSaving(true);
        try {
            const res = await apiCall('updateEmployee', { id: currentEmployee._id, item: currentEmployee });
            if (res.success) {
                success('Saved');
                setInlineEditSection(null);
                loadEmployee(true);
            } else {
                toastError('Failed to save');
            }
        } catch (err) {
            toastError('An error occurred while saving');
        } finally {
            setSaving(false);
        }
    };

    const startInlineEdit = (section: 'personal' | 'employment' | 'compliance') => {
        setCurrentEmployee({ ...employee });
        setInlineEditSection(section);
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
        return <PageSkeleton />;
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
                                    onMouseEnter={() => router.prefetch('/employees')} onClick={() => canViewEmployees ? router.push('/employees') : router.push('/')}
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
                <div className="w-full p-4 pb-24">

                    {/* Hero Header Card */}
                    <EmployeeHeaderCard
                        employee={employee}
                        onUpdate={handleQuickUpdate}
                        onEditSignature={() => setIsSignatureModalOpen(true)}
                        animate={animate}
                    />

                    {/* Details Grid */}
                    <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                            {/* Personal Info */}
                            <SectionCard
                                title="Personal Information"
                                icon={User}
                                action={
                                    inlineEditSection !== 'personal' && (
                                        <button
                                            onClick={() => startInlineEdit('personal')}
                                            className="p-1.5 rounded-lg text-indigo-500 hover:bg-white/50 hover:text-indigo-700 transition-colors"
                                            title="Edit Personal Information"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )
                                }
                            >
                                <DetailRow label="DOB" value={employee.dob} editNode={inlineEditSection === 'personal' ? <Input type="date" value={toDateInputValue(currentEmployee.dob)} onChange={e => setCurrentEmployee({ ...currentEmployee, dob: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />
                                <DetailRow label="Address" value={employee.address} editNode={inlineEditSection === 'personal' ? <Input value={currentEmployee.address || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, address: e.target.value })} className="h-8 w-full" /> : undefined} />
                                <DetailRow label="City" value={employee.city} editNode={inlineEditSection === 'personal' ? <div className="min-w-[160px]"><SearchableSelect value={currentEmployee.city || ''} onChange={(v: any) => setCurrentEmployee({ ...currentEmployee, city: v })} options={cityOptions} /></div> : undefined} />
                                <DetailRow label="State" value={employee.state} editNode={inlineEditSection === 'personal' ? <div className="min-w-[160px]"><SearchableSelect value={currentEmployee.state || ''} onChange={(v: any) => setCurrentEmployee({ ...currentEmployee, state: v })} options={stateOptions} /></div> : undefined} />
                                <DetailRow label="Zip Code" value={employee.zip} editNode={inlineEditSection === 'personal' ? <Input value={currentEmployee.zip || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, zip: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />
                                <DetailRow label="Driver License" value={employee.driverLicense} editNode={inlineEditSection === 'personal' ? <Input value={currentEmployee.driverLicense || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, driverLicense: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />

                                {inlineEditSection === 'personal' && (
                                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-gray-100/50">
                                        <Button size="sm" variant="outline" onClick={() => setInlineEditSection(null)}>Cancel</Button>
                                        <Button size="sm" onClick={handleInlineSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                                    </div>
                                )}
                            </SectionCard>

                            {/* Employment Details */}
                            <SectionCard
                                title="Employment Details"
                                icon={Briefcase}
                                action={
                                    inlineEditSection !== 'employment' && (
                                        <button
                                            onClick={() => startInlineEdit('employment')}
                                            className="p-1.5 rounded-lg text-indigo-500 hover:bg-white/50 hover:text-indigo-700 transition-colors"
                                            title="Edit Employment Details"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )
                                }
                            >
                                <DetailRow label="Date Hired" value={employee.dateHired} editNode={inlineEditSection === 'employment' ? <Input type="date" value={toDateInputValue(currentEmployee.dateHired)} onChange={e => setCurrentEmployee({ ...currentEmployee, dateHired: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />
                                <DetailRow label="App Role" value={employee.appRole} editNode={inlineEditSection === 'employment' ? <div className="min-w-[160px]"><SearchableSelect value={currentEmployee.appRole || ''} onChange={(v: any) => setCurrentEmployee({ ...currentEmployee, appRole: v })} options={appRoleOptions} /></div> : undefined} />
                                <DetailRow label="Company Position" value={employee.companyPosition} editNode={inlineEditSection === 'employment' ? <div className="min-w-[160px]"><SearchableSelect value={currentEmployee.companyPosition || ''} onChange={(v: any) => setCurrentEmployee({ ...currentEmployee, companyPosition: v })} options={positionOptions} /></div> : undefined} />
                                <DetailRow label="Designation" value={employee.designation} editNode={inlineEditSection === 'employment' ? <div className="min-w-[160px]"><SearchableSelect multiple value={currentEmployee.designation ? currentEmployee.designation.split(',').map((s: string) => s.trim()).filter(Boolean) : []} onChange={(v: any) => setCurrentEmployee({ ...currentEmployee, designation: Array.isArray(v) ? v.join(', ') : v })} options={designationOptions} /></div> : undefined} />
                                <DetailRow label="Group No." value={employee.groupNo} editNode={inlineEditSection === 'employment' ? <Input value={currentEmployee.groupNo || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, groupNo: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />
                                <DetailRow label="Separation Date" value={employee.separationDate} editNode={inlineEditSection === 'employment' ? <Input type="date" value={toDateInputValue(currentEmployee.separationDate)} onChange={e => setCurrentEmployee({ ...currentEmployee, separationDate: e.target.value })} className="h-8 min-w-[160px]" /> : undefined} />
                                {!!(inlineEditSection === 'employment' ? currentEmployee.separationDate : employee.separationDate) && (
                                    <DetailRow label="Separation Reason" value={employee.separationReason} editNode={inlineEditSection === 'employment' ? <textarea value={currentEmployee.separationReason || ''} onChange={e => setCurrentEmployee({ ...currentEmployee, separationReason: e.target.value })} className="w-full min-h-[80px] p-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y" placeholder="Enter reason..." /> : undefined} />
                                )}

                                {inlineEditSection === 'employment' && (
                                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-gray-100/50">
                                        <Button size="sm" variant="outline" onClick={() => setInlineEditSection(null)}>Cancel</Button>
                                        <Button size="sm" onClick={handleInlineSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                                    </div>
                                )}
                            </SectionCard>

                            {/* Compliance & Documents */}
                            <SectionCard
                                title="Compliance"
                                icon={FileText}
                                action={
                                    inlineEditSection !== 'compliance' && (
                                        <button
                                            onClick={() => startInlineEdit('compliance')}
                                            className="p-1.5 rounded-lg text-indigo-500 hover:bg-white/50 hover:text-indigo-700 transition-colors"
                                            title="Edit Compliance"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )
                                }
                            >
                                {(() => {
                                    const renderCompEdit = (key: keyof Employee) => {
                                        if (inlineEditSection !== 'compliance') return undefined;
                                        const isChecked = currentEmployee[key] === 'Yes';
                                        return (
                                            <div className="flex items-center gap-3 pr-2 py-1 flex-1 justify-end">
                                                <Switch
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => setCurrentEmployee({ ...currentEmployee, [key]: checked ? 'Yes' : 'No' })}
                                                />
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="flex flex-col h-full">
                                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-6 gap-y-0">
                                                <DetailRow label="Application / Resume" value={employee.applicationResume} isLink href={employee.applicationResume} editNode={renderCompEdit('applicationResume')} />
                                                <DetailRow label="Employee Handbook" value={employee.employeeHandbook} isLink href={employee.employeeHandbook} editNode={renderCompEdit('employeeHandbook')} />
                                                <DetailRow label="W4 / I9 / DD" value={employee.quickbooksW4I9DD} isLink href={employee.quickbooksW4I9DD} editNode={renderCompEdit('quickbooksW4I9DD')} />
                                                <DetailRow label="Emergency Contact" value={employee.emergencyContact} isLink href={employee.emergencyContact} editNode={renderCompEdit('emergencyContact')} />
                                                <DetailRow label="DOT Release" value={employee.dotRelease} isLink href={employee.dotRelease} editNode={renderCompEdit('dotRelease')} />
                                                <DetailRow label="DMV Pull Notice" value={employee.dmvPullNotifications} isLink href={employee.dmvPullNotifications} editNode={renderCompEdit('dmvPullNotifications')} />
                                                <DetailRow label="Driving Record Permission" value={employee.drivingRecordPermission} isLink href={employee.drivingRecordPermission} editNode={renderCompEdit('drivingRecordPermission')} />
                                                <DetailRow label="Background Check" value={employee.backgroundCheck} isLink href={employee.backgroundCheck} editNode={renderCompEdit('backgroundCheck')} />
                                                <DetailRow label="Copy of DL" value={employee.copyOfDL} isLink href={employee.copyOfDL} editNode={renderCompEdit('copyOfDL')} />
                                                <DetailRow label="Copy of SS" value={employee.copyOfSS} isLink href={employee.copyOfSS} editNode={renderCompEdit('copyOfSS')} />
                                                <DetailRow label="LCP Tracker" value={employee.lcpTracker} isLink href={employee.lcpTracker} editNode={renderCompEdit('lcpTracker')} />
                                                <DetailRow label="EDD" value={employee.edd} isLink href={employee.edd} editNode={renderCompEdit('edd')} />
                                                <DetailRow label="Auto Insurance" value={employee.autoInsurance} isLink href={employee.autoInsurance} editNode={renderCompEdit('autoInsurance')} />
                                                <DetailRow label="Veriforce / OQ" value={employee.veriforce} isLink href={employee.veriforce} editNode={renderCompEdit('veriforce')} />
                                                <DetailRow label="Union Paperwork" value={employee.unionPaperwork1184} isLink href={employee.unionPaperwork1184} editNode={renderCompEdit('unionPaperwork1184')} />
                                            </div>
                                            {inlineEditSection === 'compliance' && (
                                                <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-gray-100/50">
                                                    <Button size="sm" variant="outline" onClick={() => setInlineEditSection(null)}>Cancel</Button>
                                                    <Button size="sm" onClick={handleInlineSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </SectionCard>
                        </div>
                    </div>

                    <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

                            {/* Documents */}
                            <div className="col-span-1">
                                <SectionCard
                                    title={`Documents (${employee.documents?.length || 0})`}
                                    icon={FileText}
                                    action={
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <div className="relative group/search">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-emerald-600 transition-colors" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search docs..." 
                                                    value={docSearch}
                                                    onChange={(e) => setDocSearch(e.target.value)}
                                                    className="pl-9 pr-3 py-1 text-[10px] border border-slate-200 bg-white shadow-sm rounded-full focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-[100px] sm:w-[130px] focus:w-[150px] sm:focus:w-[180px] outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsDocModalOpen(true);
                                                    setCurrentDocModal({ ...emptyDocument });
                                                    setCurrentDocModalIdx(null);
                                                    setIsViewOnlyDoc(false);
                                                }}
                                                className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex-shrink-0"
                                                title="Add Document"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    }
                                >

                                    {(employee.documents?.length ?? 0) > 0 ? (
                                        <div className="overflow-auto max-h-[500px]">
                                            <div className="grid grid-cols-2 gap-4">
                                                {employee.documents?.map((doc: any, i: number) => {
                                                    if (docSearch) {
                                                        const match = (doc.fileName || '').toLowerCase().includes(docSearch.toLowerCase()) || 
                                                                      (doc.description || '').toLowerCase().includes(docSearch.toLowerCase());
                                                        if (!match) return null;
                                                    }
                                                    const docFiles = doc.files?.length ? doc.files : (doc.fileUrl ? [doc.fileUrl] : []);
                                                    const numFiles = docFiles.length;
                                                    const currentIdx = docThumbIdx[i] || 0;
                                                    const currentFile = docFiles[currentIdx];
                                                    const { isImage, isPdf } = getFileType(currentFile);

                                                    return (
                                                        <div key={i}
                                                            className="relative bg-white border border-slate-200 rounded-xl shadow-sm transition-all flex flex-col overflow-hidden"
                                                        >
                                                            {/* Thumbnail Preview Area */}
                                                            <div className="relative w-full h-[120px] bg-slate-50 flex items-center justify-center border-b border-slate-100 overflow-hidden group">
                                                                {numFiles > 0 ? (
                                                                    isImage ? (
                                                                        <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(currentFile, { w: 1200 })} alt="Preview" className="object-cover transition-transform duration-500 group-hover:scale-105 w-full h-full" /></div>
                                                                    ) : isPdf ? (
                                                                        <iframe src={`${currentFile}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105" title="PDF Preview" />
                                                                    ) : (
                                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                                            <FileText className="w-10 h-10 text-[#0F4C75]/40" />
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400">Document</span>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <span className="text-xs text-slate-400 font-medium">No preview</span>
                                                                )}

                                                                {numFiles > 1 && (
                                                                    <>
                                                                        <div className="absolute top-2 left-2 bg-black/60 shadow-md backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-bold flex items-center gap-1 z-10">
                                                                            {currentIdx + 1}/{numFiles}
                                                                        </div>
                                                                        {/* Arrow Navs */}
                                                                        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setDocThumbIdx(prev => ({ ...prev, [i]: currentIdx > 0 ? currentIdx - 1 : numFiles - 1 })); }}
                                                                                className="p-1 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow transition-colors"
                                                                            >
                                                                                <ChevronLeft className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setDocThumbIdx(prev => ({ ...prev, [i]: currentIdx < numFiles - 1 ? currentIdx + 1 : 0 })); }}
                                                                                className="p-1 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow transition-colors"
                                                                            >
                                                                                <ChevronRight className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Info Area */}
                                                            <div className="flex flex-col p-3 flex-1">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <h5 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight" title={doc.fileName}>{doc.fileName || 'Untitled Document'}</h5>
                                                                </div>
                                                            </div>

                                                            {/* Inline Actions (Always Visible) */}
                                                            <div className="px-3 pb-3 pt-1 border-t border-slate-50 bg-slate-50/50 mt-auto flex items-center justify-between gap-2">
                                                                {deletingDocIdx === i ? (
                                                                    <div className="flex items-center gap-2 w-full justify-between">
                                                                        <span className="text-[10px] font-bold text-red-600">Delete?</span>
                                                                        <div className="flex gap-1.5">
                                                                            <button
                                                                                onClick={() => handleDeleteDocument(i)}
                                                                                className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                                                disabled={savingDocument}
                                                                            >
                                                                                {savingDocument ? '...' : 'Yes'}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setDeletingDocIdx(null)}
                                                                                className="px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                                                                            >
                                                                                No
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Buttons Area */}
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIsDocModalOpen(true);
                                                                                    setCurrentDocModal({ ...emptyDocument, ...doc, files: docFiles });
                                                                                    setCurrentDocModalIdx(i);
                                                                                    setIsViewOnlyDoc(false);
                                                                                }}
                                                                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                                                title="Edit Document"
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setDeletingDocIdx(i)}
                                                                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                                                title="Delete Document"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                        {/* Inline File Count */}
                                                                        {numFiles > 0 && <span className="text-[10px] whitespace-nowrap bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-100">{numFiles} File{numFiles !== 1 ? 's' : ''}</span>}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-slate-400 italic">No documents uploaded yet</div>
                                    )}
                                </SectionCard>
                            </div>

                            {/* Drug Testing Records */}
                            <div className="col-span-1">
                                <SectionCard
                                    title={`Drug Testing (${employee.drugTestingRecords?.length || 0})`}
                                    icon={FlaskConical}
                                    action={
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <div className="relative group/search">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-emerald-600 transition-colors" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search records..." 
                                                    value={drugSearch}
                                                    onChange={(e) => setDrugSearch(e.target.value)}
                                                    className="pl-9 pr-3 py-1 text-[10px] border border-slate-200 bg-white shadow-sm rounded-full focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-[100px] sm:w-[130px] focus:w-[150px] sm:focus:w-[180px] outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsDrugModalOpen(true);
                                                    setCurrentDrugModal({ ...emptyDrugTest });
                                                    setCurrentDrugModalIdx(null);
                                                    setIsViewOnlyDrug(false);
                                                }}
                                                className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex-shrink-0"
                                                title="Add Drug Test Record"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    }
                                >


                                    {(employee.drugTestingRecords?.length ?? 0) > 0 ? (
                                        <div className="overflow-auto max-h-[500px]">
                                            <div className="grid grid-cols-2 gap-4">
                                                {employee.drugTestingRecords?.map((rec: any, i: number) => {
                                                    if (drugSearch) {
                                                        const match = (rec.description || '').toLowerCase().includes(drugSearch.toLowerCase()) || 
                                                                      (rec.type || '').toLowerCase().includes(drugSearch.toLowerCase());
                                                        if (!match) return null;
                                                    }
                                                    const recFiles = rec.files?.length ? rec.files : (rec.fileUrl ? [rec.fileUrl] : []);
                                                    const numFiles = recFiles.length;
                                                    const currentIdx = drugTestingThumbIdx[i] || 0;
                                                    const currentFile = recFiles[currentIdx];
                                                    const { isImage, isPdf } = getFileType(currentFile);

                                                    return (
                                                        <div key={i}
                                                            onClick={() => {
                                                                setIsDrugModalOpen(true);
                                                                setCurrentDrugModal({ ...rec });
                                                                setCurrentDrugModalIdx(i);
                                                                setIsViewOnlyDrug(true);
                                                            }}
                                                            className="relative bg-white border border-slate-200 rounded-xl shadow-sm transition-all flex flex-col overflow-hidden cursor-pointer hover:border-indigo-300 hover:shadow-md h-full"
                                                        >
                                                            {/* Thumbnail Preview Area */}
                                                            <div className="relative w-full h-[120px] bg-slate-50 flex items-center justify-center border-b border-slate-100 overflow-hidden group">
                                                                {numFiles > 0 ? (
                                                                    isImage ? (
                                                                        <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(currentFile, { w: 1200 })} alt="Preview" className="object-cover transition-transform duration-500 group-hover:scale-105 w-full h-full" /></div>
                                                                    ) : isPdf ? (
                                                                        <iframe src={`${currentFile}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105" title="PDF Preview" />
                                                                    ) : (
                                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                                            <FlaskConical className="w-10 h-10 text-blue-500/40" />
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400">Record</span>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <span className="text-xs text-slate-400 font-medium">No preview</span>
                                                                )}

                                                                {numFiles > 1 && (
                                                                    <>
                                                                        <div className="absolute top-2 left-2 bg-black/60 shadow-md backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-bold flex items-center gap-1 z-10">
                                                                            {currentIdx + 1}/{numFiles}
                                                                        </div>
                                                                        {/* Arrow Navs */}
                                                                        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setDrugTestingThumbIdx(prev => ({ ...prev, [i]: currentIdx > 0 ? currentIdx - 1 : numFiles - 1 })); }}
                                                                                className="p-1 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow transition-colors"
                                                                            >
                                                                                <ChevronLeft className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setDrugTestingThumbIdx(prev => ({ ...prev, [i]: currentIdx < numFiles - 1 ? currentIdx + 1 : 0 })); }}
                                                                                className="p-1 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow transition-colors"
                                                                            >
                                                                                <ChevronRight className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Info Area */}
                                                            <div className="flex flex-col p-3 flex-1">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">{formatDateDisplay(rec.date)}</span>
                                                                        <h5 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight" title={rec.description}>{rec.description || 'Record'}</h5>
                                                                    </div>
                                                                </div>
                                                            </div>


                                                            <div className="px-3 pb-3 pt-1 border-t border-slate-50 bg-slate-50/50 mt-auto flex items-center justify-between gap-2">
                                                                {deletingDrugTestIdx === i ? (
                                                                    <div className="flex items-center gap-2 w-full justify-between">
                                                                        <span className="text-[10px] font-bold text-red-600">Delete?</span>
                                                                        <div className="flex gap-1.5">
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDrugTest(i); }} className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors" disabled={savingDrugTest}>{savingDrugTest ? '...' : 'Yes'}</button>
                                                                            <button onClick={(e) => { e.stopPropagation(); setDeletingDrugTestIdx(null); }} className="px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors">No</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setIsDrugModalOpen(true);
                                                                                    setCurrentDrugModal({ ...rec, files: rec.files || [] });
                                                                                    setCurrentDrugModalIdx(i);
                                                                                    setIsViewOnlyDrug(false);
                                                                                }}
                                                                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                                                title="Edit record"
                                                                            >
                                                                                <Pencil className="w-4 h-4" />
                                                                            </button>
                                                                            <button onClick={(e) => { e.stopPropagation(); setDeletingDrugTestIdx(i); }} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Delete record"><Trash2 className="w-4 h-4" /></button>
                                                                        </div>
                                                                        {numFiles > 0 && <span className="text-[10px] whitespace-nowrap bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-100 italic">{numFiles} Attachment{numFiles !== 1 ? 's' : ''}</span>}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-slate-400 italic">No drug testing records yet</div>
                                    )}
                                </SectionCard>
                            </div>

                            {/* Training & Certifications */}
                            <div className="col-span-1 xl:col-span-2">
                                <SectionCard
                                    title={`Training & Certifications (${employee.trainingCertifications?.length || 0})`}
                                    icon={GraduationCap}
                                    action={
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <div className="relative group/search">
                                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-emerald-600 transition-colors" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search training..." 
                                                    value={trainingSearch}
                                                    onChange={(e) => setTrainingSearch(e.target.value)}
                                                    className="pl-9 pr-3 py-1 text-[10px] border border-slate-200 bg-white shadow-sm rounded-full focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-[100px] sm:w-[130px] focus:w-[150px] sm:focus:w-[180px] outline-none font-medium"
                                                />
                                            </div>
                                            <button
                                                onClick={() => { 
                                                    setCurrentTrainingModal({ ...emptyTraining });
                                                    setCurrentTrainingModalIdx(null);
                                                    setIsViewOnlyTraining(false);
                                                    setIsTrainingModalOpen(true);
                                                }}
                                                className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50 transition-all hover:scale-110 active:scale-95"
                                                title="Add Training / Certification"
                                            >
                                                <Plus className="w-5 h-5 shadow-sm" />
                                            </button>
                                        </div>
                                    }
                                >
                                    <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                                        <div className="overflow-auto max-h-[500px]">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type / Category</th>
                                                        <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Dates</th>
                                                        <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                        <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Docs</th>
                                                        <th className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {(employee.trainingCertifications || []).length > 0 ? (
                                                        (employee.trainingCertifications || []).map((rec: any, i: number) => {
                                                            if (trainingSearch) {
                                                                const match = (rec.category || '').toLowerCase().includes(trainingSearch.toLowerCase()) || 
                                                                              (rec.type || '').toLowerCase().includes(trainingSearch.toLowerCase()) ||
                                                                              (rec.description || '').toLowerCase().includes(trainingSearch.toLowerCase());
                                                                if (!match) return null;
                                                            }
                                                            
                                                            const numFiles = (rec.files?.length || 0) + (rec.fileUrl ? 1 : 0);

                                                            return (
                                                                <tr 
                                                                    key={i} 
                                                                    onClick={() => {
                                                                        setCurrentTrainingModal({ ...rec, files: rec.files || [] });
                                                                        setCurrentTrainingModalIdx(i);
                                                                        setIsViewOnlyTraining(true);
                                                                        setIsTrainingModalOpen(true);
                                                                    }}
                                                                    className="group hover:bg-emerald-50/30 transition-colors cursor-pointer"
                                                                >
                                                                    <td className="py-3 px-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-emerald-700 transition-colors">{rec.type || 'Untitled Training'}</span>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <span className="text-[10px] font-medium text-slate-400">{rec.category || 'No Category'}</span>
                                                                                <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                <span className="text-[10px] font-medium text-slate-400 line-clamp-1">{rec.frequency || 'N/A'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                            {rec.completionDate && (
                                                                                <span className="text-[10px] font-bold text-slate-600">Done: {formatDateDisplay(rec.completionDate)}</span>
                                                                            )}
                                                                            {rec.renewalDate && (
                                                                                <span className="text-[10px] font-medium text-red-500/80">Renews: {formatDateDisplay(rec.renewalDate)}</span>
                                                                            )}
                                                                            {!rec.completionDate && !rec.renewalDate && (
                                                                                <span className="text-[10px] text-slate-300 italic">No dates set</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        {rec.status ? (
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                                                rec.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                                                                                rec.status === 'Expired' ? 'bg-red-100 text-red-700' : 
                                                                                'bg-amber-100 text-amber-700'
                                                                            }`}>
                                                                                {rec.status}
                                                                            </span>
                                                                        ) : <span className="text-slate-300 italic text-[10px]">N/A</span>}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${numFiles > 0 ? 'bg-indigo-50 text-indigo-500 shadow-sm border border-indigo-100' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                            </div>
                                                                            {numFiles > 0 && <span className="text-[10px] font-bold text-slate-500">{numFiles}</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right">
                                                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setCurrentTrainingModal({ ...rec, files: rec.files || [] });
                                                                                    setCurrentTrainingModalIdx(i);
                                                                                    setIsViewOnlyTraining(false);
                                                                                    setIsTrainingModalOpen(true);
                                                                                }}
                                                                                className="p-1.5 bg-white text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-100 shadow-sm transition-all active:scale-90"
                                                                                title="Edit Record"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            {deletingTrainingIdx === i ? (
                                                                                <div className="flex items-center gap-1 ml-1 bg-red-50 p-0.5 rounded-lg border border-red-100 animate-in fade-in slide-in-from-right-2">
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTraining(i); }} className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors" disabled={savingTraining}>{savingTraining ? '...' : 'Yes'}</button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setDeletingTrainingIdx(null); }} className="px-2 py-0.5 text-[10px] font-bold bg-white text-slate-400 rounded-md hover:bg-slate-100 transition-colors">No</button>
                                                                                </div>
                                                                            ) : (
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); setDeletingTrainingIdx(i); }} 
                                                                                    className="p-1.5 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-100 shadow-sm transition-all active:scale-90"
                                                                                    title="Delete Record"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={5} className="py-12 text-center text-slate-400 italic text-sm">No training found</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </SectionCard>
                            </div>
                        </div>
                    </div>

                    {/* ── Performance Score (proposal writers only) ─────────── */}
                    {(() => {
                        const fullName = `${employee.firstName} ${employee.lastName}`.trim();
                        return <EmployeePerformanceSection writerName={fullName} employeeEmail={employee.email} />;
                    })()}

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
                                                <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                    src={currentEmployee.profilePicture}
                                                    alt="Profile"
                                                    className="object-cover w-full h-full"
                                                /></div>
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

            {/* Document Add/Edit/View Modal */}
            <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title={isViewOnlyDoc ? "View Document" : currentDocModalIdx !== null ? "Edit Document" : "Add New Document"} maxWidth="2xl">
                <div className="space-y-5">
                    <div className="flex items-end gap-3 mt-1">
                        <div className="flex-1 space-y-1">
                            <label className="text-sm font-medium text-slate-700">File Name</label>
                            <Input placeholder="e.g. W-4 Form, Contract" value={currentDocModal.fileName || ''} onChange={e => setCurrentDocModal({ ...currentDocModal, fileName: e.target.value })} disabled={isViewOnlyDoc} className="h-10" />
                        </div>
                        {!isViewOnlyDoc && (
                            <label className="shrink-0 flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-slate-600 bg-white">
                                <Upload className="w-4 h-4" />
                                <span>Upload Files</span>
                                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" multiple onChange={e => {
                                    if (e.target.files) {
                                        handleFileUpload(e.target.files, (urls) => {
                                            setCurrentDocModal((prev: any) => ({ ...prev, files: [...(prev.files || []), ...urls] }));
                                        }, 'documents', setIsUploadingDoc);
                                    }
                                    e.target.value = '';
                                }} />
                            </label>
                        )}
                    </div>

                        {(currentDocModal.files || []).length > 0 ? (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {(currentDocModal.files || []).map((fileUrl: string, idx: number) => {
                                    const { isImage, isPdf } = getFileType(fileUrl);

                                    return (
                                        <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-[100px] shadow-sm">
                                            {isImage ? (
                                                <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(fileUrl, { w: 1200 })} alt="Preview" className="object-cover transition-transform duration-500 group-hover:scale-105 w-full h-full" /></div>
                                            ) : isPdf ? (
                                                <iframe src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105" title="PDF Preview" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 transition-transform duration-500 group-hover:scale-105">
                                                    <FileText className="w-8 h-8 text-[#0F4C75]/40" />
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Doc {idx + 1}</span>
                                                </div>
                                            )}
                                            
                                            {/* Action Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <button type="button" onClick={() => openFileUrl(fileUrl)} className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-sm transition-colors" title="View File">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                                {!isViewOnlyDoc && (
                                                    <button type="button" onClick={() => setCurrentDocModal((prev: any) => ({ ...prev, files: prev.files.filter((_: any, j: number) => j !== idx) }))} className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg shadow-sm transition-colors" title="Remove File">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50 mt-2">
                                No files attached
                            </div>
                        )}
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={() => setIsDocModalOpen(false)}>
                        {isViewOnlyDoc ? 'Close' : 'Cancel'}
                    </Button>
                    {!isViewOnlyDoc && (
                        <Button 
                            className={`bg-[#0F4C75] text-white relative min-w-[160px] transition-all duration-300 ${savingDocument ? 'opacity-90 cursor-wait bg-[#0a3a5c]' : 'hover:bg-[#0a3a5c] shadow-sm hover:shadow'}`}
                            onClick={handleDocModalSave} 
                            disabled={savingDocument}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {savingDocument ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
                                        <span className="animate-pulse font-medium tracking-wide">
                                            {(currentDocModal?.files?.length ?? 0) > 0 ? 'Uploading Files...' : 'Saving...'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        <span className="font-medium">Save Document</span>
                                    </>
                                )}
                            </div>
                        </Button>
                    )}
                </div>
            </Modal>

            {/* Drug Testing Add/Edit Modal */}
            <Modal isOpen={isDrugModalOpen} onClose={() => setIsDrugModalOpen(false)} title={isViewOnlyDrug ? "View Record" : currentDrugModalIdx !== null ? "Edit Record" : "Add New Drug Test"} maxWidth="2xl">
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Test Date</label>
                            <Input type="date" value={toDateInputValue(currentDrugModal.date)} onChange={e => setCurrentDrugModal({ ...currentDrugModal, date: e.target.value })} disabled={isViewOnlyDrug} className="h-10" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Description</label>
                            <Input placeholder="e.g. Annual Random Test" value={currentDrugModal.description || ''} onChange={e => setCurrentDrugModal({ ...currentDrugModal, description: e.target.value })} disabled={isViewOnlyDrug} className="h-10" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attached Files</label>
                            {!isViewOnlyDrug && (
                                <label className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold border border-slate-200 rounded-full cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all text-slate-600 shadow-sm bg-white">
                                    <Upload className="w-3 h-3" />
                                    <span>Upload Files</span>
                                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" multiple onChange={e => {
                                        if (e.target.files) {
                                            handleFileUpload(e.target.files, (urls) => {
                                                setCurrentDrugModal((prev: any) => ({ ...prev, files: [...(prev.files || []), ...urls] }));
                                            }, 'drug-testing', setIsUploadingDrug);
                                        }
                                        e.target.value = '';
                                    }} />
                                </label>
                            )}
                        </div>

                        {(currentDrugModal.files || []).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {(currentDrugModal.files || []).map((fileUrl: string, idx: number) => {
                                    const { isImage, isPdf } = getFileType(fileUrl);

                                    return (
                                        <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-[100px] shadow-sm">
                                            {isImage ? (
                                                <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(fileUrl, { w: 1200 })} alt="Preview" className="object-cover transition-transform duration-500 group-hover:scale-105 w-full h-full" /></div>
                                            ) : isPdf ? (
                                                <iframe src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105" title="PDF Preview" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 transition-transform duration-500 group-hover:scale-105">
                                                    <FlaskConical className="w-8 h-8 text-indigo-400/40" />
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 italic">File {idx + 1}</span>
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <button type="button" onClick={() => openFileUrl(fileUrl)} className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-sm transition-colors">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {!isViewOnlyDrug && (
                                                    <button type="button" onClick={() => setCurrentDrugModal((prev: any) => ({ ...prev, files: prev.files.filter((_: any, j: number) => j !== idx) }))} className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg shadow-sm transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-[11px] font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                No files attached to this record
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={() => setIsDrugModalOpen(false)} className="rounded-full px-6">
                        {isViewOnlyDrug ? 'Close' : 'Cancel'}
                    </Button>
                    {!isViewOnlyDrug && (
                        <Button 
                            className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white rounded-full px-8 shadow-md"
                            onClick={handleSaveDrugModal}
                            disabled={savingDrugTest || isUploadingDrug}
                        >
                            {savingDrugTest || isUploadingDrug ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{isUploadingDrug ? 'Uploading...' : 'Saving...'}</span>
                                </div>
                            ) : (
                                <span>Save Changes</span>
                            )}
                        </Button>
                    )}
                </div>
            </Modal>

            {/* Training & Certifications Add/Edit Modal */}
            <Modal isOpen={isTrainingModalOpen} onClose={() => setIsTrainingModalOpen(false)} title={isViewOnlyTraining ? "View Record" : currentTrainingModalIdx !== null ? "Edit Record" : "Add Training / Certification"} maxWidth="3xl">
                <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Category</label>
                            <Select onValueChange={val => setCurrentTrainingModal({ ...currentTrainingModal, category: val })} value={currentTrainingModal.category || ''} disabled={isViewOnlyTraining}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    {TRAINING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Type</label>
                            <Select onValueChange={val => setCurrentTrainingModal({ ...currentTrainingModal, type: val })} value={currentTrainingModal.type || ''} disabled={isViewOnlyTraining}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Frequency</label>
                            <Select onValueChange={val => setCurrentTrainingModal({ ...currentTrainingModal, frequency: val })} value={currentTrainingModal.frequency || ''} disabled={isViewOnlyTraining}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                <SelectContent>
                                    {TRAINING_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Status</label>
                            <Select onValueChange={val => setCurrentTrainingModal({ ...currentTrainingModal, status: val })} value={currentTrainingModal.status || ''} disabled={isViewOnlyTraining}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    {TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Assigned Date</label>
                            <Input type="date" value={toDateInputValue(currentTrainingModal.assignedDate)} onChange={e => setCurrentTrainingModal({ ...currentTrainingModal, assignedDate: e.target.value })} disabled={isViewOnlyTraining} className="h-10 font-medium" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Completion Date</label>
                            <Input type="date" value={toDateInputValue(currentTrainingModal.completionDate)} onChange={e => setCurrentTrainingModal({ ...currentTrainingModal, completionDate: e.target.value })} disabled={isViewOnlyTraining} className="h-10 font-medium" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Renewal Date</label>
                            <Input type="date" value={toDateInputValue(currentTrainingModal.renewalDate)} onChange={e => setCurrentTrainingModal({ ...currentTrainingModal, renewalDate: e.target.value })} disabled={isViewOnlyTraining} className="h-10 font-medium" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Description</label>
                        <Input placeholder="Enter details about this training..." value={currentTrainingModal.description || ''} onChange={e => setCurrentTrainingModal({ ...currentTrainingModal, description: e.target.value })} disabled={isViewOnlyTraining} className="h-10" />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document(s)</label>
                            {!isViewOnlyTraining && (
                                <label className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold border border-slate-200 rounded-full cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all text-slate-600 shadow-sm bg-white">
                                    <Upload className="w-3 h-3" />
                                    <span>Upload Files</span>
                                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" multiple onChange={e => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleFileUpload(e.target.files, (urls) => {
                                                setCurrentTrainingModal((prev: any) => ({ ...prev, files: [...(prev.files || []), ...urls] }));
                                            }, 'training', setIsUploadingTraining);
                                        }
                                        e.target.value = '';
                                    }} />
                                </label>
                            )}
                        </div>

                        {(currentTrainingModal.files || []).length > 0 || currentTrainingModal.fileUrl ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[...(currentTrainingModal.fileUrl ? [currentTrainingModal.fileUrl] : []), ...(currentTrainingModal.files || [])].map((fileUrl: string, idx: number) => {
                                    const { isImage, isPdf } = getFileType(fileUrl);

                                    return (
                                        <div key={idx} className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-[100px] shadow-sm">
                                            {isImage ? (
                                                <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(fileUrl, { w: 1200 })} alt="Preview" className="object-cover transition-transform duration-500 group-hover:scale-105 w-full h-full" /></div>
                                            ) : isPdf ? (
                                                <iframe src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105" title="PDF Preview" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 transition-transform duration-500 group-hover:scale-105">
                                                    <GraduationCap className="w-8 h-8 text-emerald-400/40" />
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 italic">File {idx + 1}</span>
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <button type="button" onClick={() => openFileUrl(fileUrl)} className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-sm transition-colors">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {!isViewOnlyTraining && (
                                                    <button type="button" onClick={() => {
                                                        if (idx === 0 && currentTrainingModal.fileUrl) {
                                                            setCurrentTrainingModal({ ...currentTrainingModal, fileUrl: '' });
                                                        } else {
                                                            const filesIdx = currentTrainingModal.fileUrl ? idx - 1 : idx;
                                                            setCurrentTrainingModal((prev: any) => ({ ...prev, files: prev.files.filter((_: any, j: number) => j !== filesIdx) }));
                                                        }
                                                    }} className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg shadow-sm transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-[11px] font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                No files attached to this record
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={() => setIsTrainingModalOpen(false)} className="rounded-full px-6">
                        {isViewOnlyTraining ? 'Close' : 'Cancel'}
                    </Button>
                    {!isViewOnlyTraining && (
                        <Button 
                            className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white rounded-full px-8 shadow-md"
                            onClick={handleSaveTrainingModal}
                            disabled={savingTraining || isUploadingTraining}
                        >
                            {savingTraining || isUploadingTraining ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{isUploadingTraining ? 'Uploading...' : 'Saving...'}</span>
                                </div>
                            ) : (
                                <span>Save Changes</span>
                            )}
                        </Button>
                    )}
                </div>
            </Modal>

        </div>
    );
}
