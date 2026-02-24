"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Upload, User, Shield, Check, X, ChevronRight, Save, ChevronDown, Eye, EyeOff, RefreshCw, Copy, FileText, FlaskConical, GraduationCap, Plus, Trash2 } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription
} from "@/components/ui/form"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { cn } from "@/lib/utils"
import { SignaturePad } from "@/components/ui/SignaturePad"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/Badge"
import { useToast } from "@/hooks/useToast"
import { MyDropDown } from "@/components/ui/MyDropDown"
import { usePermissions } from "@/hooks/usePermissions"


const DESIGNATION_OPTIONS = [
    { id: 'Project Manager', label: 'Project Manager', value: 'Project Manager' },
    { id: 'Foreman', label: 'Foreman', value: 'Foreman' },
];

const INITIAL_COMPANY_POSITIONS = [
    { id: 'Developer', label: 'Developer', value: 'Developer' },
    { id: 'Chief Marketing Officer', label: 'Chief Marketing Officer', value: 'Chief Marketing Officer' },
    { id: 'Chief Financial Officer', label: 'Chief Financial Officer', value: 'Chief Financial Officer' },
    { id: 'Chief Executive Officer', label: 'Chief Executive Officer', value: 'Chief Executive Officer' },
    { id: 'Group 1', label: 'Group 1', value: 'Group 1' },
    { id: 'Group 2', label: 'Group 2', value: 'Group 2' },
    { id: 'Group 3', label: 'Group 3', value: 'Group 3' },
    { id: 'Group 4', label: 'Group 4', value: 'Group 4' },
    { id: 'Apprentice 1', label: 'Apprentice 1', value: 'Apprentice 1' },
    { id: 'Apprentice 2', label: 'Apprentice 2', value: 'Apprentice 2' },
    { id: 'Apprentice 3', label: 'Apprentice 3', value: 'Apprentice 3' },
];


// -----------------------------------------------------------------------------
// Schema Definition
// -----------------------------------------------------------------------------
const employeeSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    recordId: z.string().optional(),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    dob: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    password: z.string().optional(),
    profilePicture: z.string().optional(),
    signature: z.string().optional(),
    driverLicense: z.string().optional(),
    ssNumber: z.string().optional(),

    // Employment Details
    appRole: z.string().optional(),
    companyPosition: z.string().optional(),
    designation: z.string().optional(), // Storing as comma separated string or managing array manually
    groupNo: z.string().optional(),
    dateHired: z.string().optional(),
    hourlyRateSITE: z.coerce.number().optional(),
    hourlyRateDrive: z.coerce.number().optional(),
    status: z.string().default("Active"),
    isScheduleActive: z.boolean().default(true),
    separationDate: z.string().optional(),
    separationReason: z.string().optional(),

    // Compliance
    applicationResume: z.string().optional(),
    employeeHandbook: z.string().optional(),
    quickbooksW4I9DD: z.string().optional(),
    workforce: z.string().optional(),
    emergencyContact: z.string().optional(),
    dotRelease: z.string().optional(),
    dmvPullNotifications: z.string().optional(),
    drivingRecordPermission: z.string().optional(),
    backgroundCheck: z.string().optional(),
    copyOfDL: z.string().optional(),
    copyOfSS: z.string().optional(),
    lcpTracker: z.string().optional(),
    edd: z.string().optional(),
    autoInsurance: z.string().optional(),
    veriforce: z.string().optional(),
    unionPaperwork1184: z.string().optional(),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>
// Helper type for receiving data which might include _id
type EmployeeData = Partial<EmployeeFormValues> & { _id?: string }

interface EmployeeFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: EmployeeData | null
    onSave: () => void
    roles?: { name: string, color?: string, icon?: string }[]
}

const COMPLIANCE_FIELDS = [
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
]
    
const formatPhoneNumber = (value: string) => {
    if (!value) return value
    const phoneNumber = value.replace(/[^\d]/g, "")
    const phoneNumberLength = phoneNumber.length
    if (phoneNumberLength < 4) return phoneNumber
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

// Generate a strong random password
function generateStrongPassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const symbols = '!@#$%&*'
    const all = upper + lower + digits + symbols
    // Ensure at least one of each type
    let password = ''
    password += upper[Math.floor(Math.random() * upper.length)]
    password += lower[Math.floor(Math.random() * lower.length)]
    password += digits[Math.floor(Math.random() * digits.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    for (let i = 4; i < 12; i++) {
        password += all[Math.floor(Math.random() * all.length)]
    }
    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('')
}

export function EmployeeForm({ open, onOpenChange, initialData, onSave, roles = [] }: EmployeeFormProps) {
    const [activeTab, setActiveTab] = useState("personal")
    const [isLoading, setIsLoading] = useState(false)
    const [designationOpen, setDesignationOpen] = useState(false)
    const [companyPositionOpen, setCompanyPositionOpen] = useState(false)
    const [companyPositions, setCompanyPositions] = useState(INITIAL_COMPANY_POSITIONS)
    const [isAddingPosition, setIsAddingPosition] = useState(false)
    const [frequencyOpen, setFrequencyOpen] = useState(false)
    const [isAddingFrequency, setIsAddingFrequency] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const { success, error: showError } = useToast()
    const { user: currentUser } = usePermissions()
    const isAdminOrSuper = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
    const isOwnRecord = !initialData?._id || currentUser?.email === initialData?._id || currentUser?.userId === initialData?._id
    const isNewEmployee = !initialData?._id

    // --- Sub-document array state ---
    type DocRecord = { date: string; type: string; description: string; fileUrl: string }
    type DrugRecord = { date: string; type: string; description: string; fileUrl: string; files: string[] }
    type TrainingRecord = { category: string; type: string; frequency: string; assignedDate: string; completionDate: string; renewalDate: string; description: string; status: string; fileUrl: string; createdBy: string; createdAt: string }

    const [documents, setDocuments] = useState<DocRecord[]>((initialData as any)?.documents || [])
    const [drugRecords, setDrugRecords] = useState<DrugRecord[]>((initialData as any)?.drugTestingRecords || [])
    const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>((initialData as any)?.trainingCertifications || [])

    const emptyDoc: DocRecord = { date: '', type: '', description: '', fileUrl: '' }
    const emptyDrug: DrugRecord = { date: '', type: 'Drug / Alcohol Testing Auth', description: '', fileUrl: '', files: [] }
    const emptyTraining: TrainingRecord = { category: '', type: '', frequency: '', assignedDate: '', completionDate: '', renewalDate: '', description: '', status: '', fileUrl: '', createdBy: '', createdAt: '' }

    const [newDoc, setNewDoc] = useState<DocRecord>({ ...emptyDoc })
    const [newDrug, setNewDrug] = useState<DrugRecord>({ ...emptyDrug })
    const [newTraining, setNewTraining] = useState<TrainingRecord>({ ...emptyTraining })

    const TRAINING_TYPES = ['Union Bootcamp', 'Osha', 'First Aid', 'Veriforce', 'Trenching and Excavating', 'Additional Training', 'CPR/First Aid']
    const TRAINING_CATEGORIES = ['Other', 'HEAVY EQUIPMENT RELATED']
    const TRAINING_STATUSES = ['Pending', 'In Progress', 'Completed', 'Expired', 'Renewed']
    const DEFAULT_FREQUENCIES = ['N/A', 'None', 'Once', 'One Time', 'W/R', 'Annually', 'Bi-Annually', 'Every 3 Years', 'Every 5 Years', 'As Needed']
    const [trainingFrequencies, setTrainingFrequencies] = useState<string[]>(DEFAULT_FREQUENCIES)

    const handleAddPosition = async (search: string) => {
        setIsAddingPosition(true)
        // Locally add for the form instance
        const newPosition = { id: search, label: search, value: search }
        setCompanyPositions([...companyPositions, newPosition])
        form.setValue("companyPosition", search)
        setIsAddingPosition(false)
        setCompanyPositionOpen(false)
    }

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema) as any,
        defaultValues: {
            firstName: initialData?.firstName ?? "",
            lastName: initialData?.lastName ?? "",
            recordId: (initialData as any)?.recordId ?? "",
            email: initialData?.email ?? "",
            phone: initialData?.phone ?? "",
            mobile: initialData?.mobile ?? "",
            dob: initialData?.dob ?? "",
            address: initialData?.address ?? "",
            city: initialData?.city ?? "",
            state: initialData?.state ?? "",
            zip: initialData?.zip ?? "",
            password: initialData?.password ?? "",
            profilePicture: initialData?.profilePicture ?? "",
            signature: initialData?.signature ?? "",
            driverLicense: initialData?.driverLicense ?? "",
            ssNumber: (initialData as any)?.ssNumber ?? "",
            appRole: initialData?.appRole ?? "",
            companyPosition: initialData?.companyPosition ?? "",
            designation: initialData?.designation ?? "",
            groupNo: initialData?.groupNo ?? "",
            dateHired: initialData?.dateHired ?? "",
            hourlyRateSITE: initialData?.hourlyRateSITE ?? 0,
            hourlyRateDrive: initialData?.hourlyRateDrive ?? 0,
            status: initialData?.status ?? "Active",
            isScheduleActive: initialData?.isScheduleActive ?? true,
            separationDate: initialData?.separationDate ?? "",
            separationReason: initialData?.separationReason ?? "",
            // Compliance
            applicationResume: initialData?.applicationResume ?? "",
            employeeHandbook: initialData?.employeeHandbook ?? "",
            quickbooksW4I9DD: initialData?.quickbooksW4I9DD ?? "",
            workforce: initialData?.workforce ?? "",
            emergencyContact: initialData?.emergencyContact ?? "",
            dotRelease: initialData?.dotRelease ?? "",
            dmvPullNotifications: initialData?.dmvPullNotifications ?? "",
            drivingRecordPermission: initialData?.drivingRecordPermission ?? "",
            backgroundCheck: initialData?.backgroundCheck ?? "",
            copyOfDL: initialData?.copyOfDL ?? "",
            copyOfSS: initialData?.copyOfSS ?? "",
            lcpTracker: initialData?.lcpTracker ?? "",
            edd: initialData?.edd ?? "",
            autoInsurance: initialData?.autoInsurance ?? "",
            veriforce: initialData?.veriforce ?? "",
            unionPaperwork1184: initialData?.unionPaperwork1184 ?? "",
        },
    })

    async function onSubmit(data: EmployeeFormValues) {
        // Require password when creating new employee
        if (!initialData?._id && (!data.password || data.password.trim() === '')) {
            showError('Password is required for new employees')
            setActiveTab('personal')
            return
        }
        setIsLoading(true)
        try {
            const action = initialData?._id ? 'updateEmployee' : 'addEmployee'
            // Strip empty password from update payloads to avoid overwriting
            const submitData: any = { ...data }
            if (initialData?._id && (!submitData.password || submitData.password.trim() === '')) {
                delete submitData.password
            }
            // Attach sub-document arrays
            submitData.documents = documents
            submitData.drugTestingRecords = drugRecords
            submitData.trainingCertifications = trainingRecords

            const payload = initialData?._id
                ? { id: initialData._id, item: submitData }
                : { item: submitData }

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            })

            const result = await res.json()
            if (result.success) {
                success(initialData?._id ? "Employee updated successfully" : "Employee added successfully")
                onSave()
                onOpenChange(false)
            } else {
                 showError(result.error || "Something went wrong")
            }
        } catch (err) {
            console.error(err)
             showError("Failed to save employee")
        } finally {
            setIsLoading(false)
        }
    }

    // Helper for file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                form.setValue("profilePicture", reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    // Custom Tab Trigger Component for Vertical Layout
    const SidebarTabTrigger = ({ value, label, icon: Icon, hasError = false }: { value: string, label: string, icon: any, hasError?: boolean }) => (
        <TabsTrigger
            value={value}
            className={cn(
                "w-full justify-start gap-3 px-4 py-3 h-auto text-sm font-medium rounded-lg transition-all",
                "data-[state=active]:bg-[#0F4C75] data-[state=active]:text-white data-[state=active]:shadow-md",
                "hover:bg-slate-100 data-[state=active]:hover:bg-[#0F4C75]",
                hasError && "text-red-500 data-[state=active]:text-red-100"
            )}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            {hasError && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
            <ChevronRight className={cn("ml-auto w-4 h-4 opacity-50", activeTab === value ? "text-white" : "text-slate-400")} />
        </TabsTrigger>
    )

    const errors = form.formState.errors

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
            <DialogContent className="sm:max-w-5xl p-0 gap-0 overflow-hidden bg-white h-[85vh] max-h-[90vh] flex flex-col">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        {initialData?._id ? "Edit Employee" : "New Employee"}
                        {initialData?.status && (
                            <Badge variant={initialData.status === 'Active' ? 'success' : 'default'} className="ml-2">
                                {initialData.status}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden min-h-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full h-full overflow-hidden">
                            
                            {/* Left Sidebar - Tabs */}
                            <div className="w-64 bg-slate-50/50 border-r flex flex-col p-4 gap-2">
                                <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full flex-col">
                                    <TabsList className="bg-transparent h-auto flex-col items-stretch space-y-1 p-0 border-none shadow-none">
                                        <SidebarTabTrigger 
                                            value="personal" 
                                            label="Personal Info" 
                                            icon={User} 
                                            hasError={!!errors.firstName || !!errors.lastName || !!errors.email} 
                                        />
                                        <SidebarTabTrigger 
                                            value="employment" 
                                            label="Employment Details" 
                                            icon={Shield} 
                                            hasError={!!errors.appRole || !!errors.status}
                                        />
                                        <SidebarTabTrigger 
                                            value="compliance" 
                                            label="Files & Compliance" 
                                            icon={Check} 
                                        />
                                        <SidebarTabTrigger 
                                            value="documents" 
                                            label="Documents" 
                                            icon={FileText} 
                                        />
                                        <SidebarTabTrigger 
                                            value="drugTesting" 
                                            label="Drug Testing" 
                                            icon={FlaskConical} 
                                        />
                                        <SidebarTabTrigger 
                                            value="training" 
                                            label="Training & Certs" 
                                            icon={GraduationCap} 
                                        />
                                    </TabsList>
                                </Tabs>
                                
                                <div className="mt-auto p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <p className="text-xs text-slate-500 mb-2 font-semibold">Profile Completion</p>
                                    <div className="text-xs text-slate-400">
                                        Fill in all legally required fields to ensure compliance.
                                    </div>
                                </div>
                            </div>

                            {/* Right Content - Form Fields */}
                            <div className="flex-1 overflow-y-auto p-0 h-full scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                <div className="p-8 max-w-3xl mx-auto">
                                    {/* --- Tab: Personal Info --- */}
                                    <div className={cn(activeTab === "personal" ? "block" : "hidden", "space-y-8 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="firstName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="John" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="lastName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Last Name <span className="text-red-500">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Doe" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="recordId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Employee ID</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="EMP-001" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input type="email" placeholder="john.doe@company.com" {...field} disabled={!!initialData?._id} />
                                                        </FormControl>

                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="dob"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Date of Birth</FormLabel>
                                                        <FormControl>
                                                            <Input type="date" {...field} value={field.value || ''} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="phone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Phone</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                placeholder="(555) 123-4567" 
                                                                {...field} 
                                                                onChange={(e) => {
                                                                    const formatted = formatPhoneNumber(e.target.value)
                                                                    field.onChange(formatted)
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="mobile"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Mobile</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                placeholder="(555) 987-6543" 
                                                                {...field} 
                                                                onChange={(e) => {
                                                                    const formatted = formatPhoneNumber(e.target.value)
                                                                    field.onChange(formatted)
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {(isOwnRecord || isNewEmployee) ? (
                                                <FormField
                                                    control={form.control}
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Password {isNewEmployee && <span className="text-red-500">*</span>}</FormLabel>
                                                            <div className="relative">
                                                                <FormControl>
                                                                    <Input
                                                                        type={showPassword ? "text" : "password"}
                                                                        placeholder={initialData?._id ? "••••••••" : "Set password"}
                                                                        {...field}
                                                                        className="pr-24"
                                                                    />
                                                                </FormControl>
                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPassword(!showPassword); }}
                                                                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                                        title={showPassword ? "Hide password" : "Show password"}
                                                                    >
                                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault(); e.stopPropagation();
                                                                            const suggested = generateStrongPassword()
                                                                            field.onChange(suggested)
                                                                            setShowPassword(true)
                                                                        }}
                                                                        className="p-1.5 rounded-md text-slate-400 hover:text-[#0F4C75] hover:bg-blue-50 transition-colors"
                                                                        title="Generate strong password"
                                                                    >
                                                                        <RefreshCw className="w-4 h-4" />
                                                                    </button>
                                                                    {field.value && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.preventDefault(); e.stopPropagation();
                                                                                navigator.clipboard.writeText(field.value || '')
                                                                                success('Password copied!')
                                                                            }}
                                                                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                                            title="Copy password"
                                                                        >
                                                                            <Copy className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ) : (
                                                <div>
                                                    <p className="text-sm font-medium mb-2">Password</p>
                                                    <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-lg bg-slate-50">
                                                        <span className="text-sm text-slate-400 tracking-widest">••••••••</span>
                                                        <span className="ml-auto text-xs text-slate-400">Hidden</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1">Only this employee can view their own password</p>
                                                </div>
                                            )}
                                            <FormField
                                                control={form.control}
                                                name="driverLicense"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Driver License #</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="D1234567" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {isAdminOrSuper && (
                                                <FormField
                                                    control={form.control}
                                                    name="ssNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>SS #</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="XXX-XX-XXXX" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            <FormField
                                                control={form.control}
                                                name="address"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>Street Address</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="123 Main St" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="city"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>City</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="New York" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="state"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>State</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="NY" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="zip"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Zip</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="10001" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <Separator />

                                        {/* Profile Picture & Signature Section */}
                                        <div className="flex flex-col md:flex-row gap-8 items-start mb-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
                                            <FormField
                                                control={form.control}
                                                name="profilePicture"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col items-center gap-3">
                                                        <FormLabel className="sr-only">Profile Picture</FormLabel>
                                                        <div className="relative group cursor-pointer w-32 h-32">
                                                            <Avatar className="w-full h-full border-4 border-white shadow-md">
                                                                <AvatarImage src={field.value} className="object-cover"/>
                                                                <AvatarFallback className="text-2xl bg-slate-200">
                                                                    {form.getValues("firstName")?.[0]}{form.getValues("lastName")?.[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                                <Upload className="w-6 h-6 text-white" />
                                                            </div>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                onChange={handleFileUpload}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500">Tap to upload photo</p>
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex-1 w-full relative">
                                                <FormLabel className="mb-2 block text-sm font-semibold text-slate-700">Digital Signature</FormLabel>
                                                    <SignaturePad
                                                        value={form.getValues("signature")}
                                                        onChange={(sig) => form.setValue("signature", sig)}
                                                    />
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- Tab: Employment Details --- */}
                                    <div className={cn(activeTab === "employment" ? "block" : "hidden", "space-y-6 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="appRole"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>App Role</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select role" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {roles.map(role => (
                                                                    <SelectItem key={role.name} value={role.name}>
                                                                        <div className="flex items-center gap-2">
                                                                            {/* Icon could go here */}
                                                                            {role.name}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            
                                            <FormField
                                                control={form.control}
                                                name="status"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Status</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Status" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Active"><Badge variant="success">Active</Badge></SelectItem>
                                                                <SelectItem value="Inactive"><Badge variant="default">Inactive</Badge></SelectItem>
                                                                <SelectItem value="Terminated"><Badge variant="danger">Terminated</Badge></SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="companyPosition"
                                                render={({ field }) => (
                                                    <FormItem className="relative">
                                                        <FormLabel>Company Position</FormLabel>
                                                        <FormControl>
                                                            <div 
                                                                id="company-position-trigger"
                                                                className="flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg bg-white cursor-pointer hover:border-[#0F4C75] transition-all"
                                                                onClick={() => setCompanyPositionOpen(!companyPositionOpen)}
                                                            >
                                                                <span className={cn("text-sm", !field.value && "text-slate-400")}>
                                                                    {field.value || "Select position"}
                                                                </span>
                                                                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", companyPositionOpen && "rotate-180")} />
                                                            </div>
                                                        </FormControl>
                                                        <MyDropDown
                                                            isOpen={companyPositionOpen}
                                                            onClose={() => setCompanyPositionOpen(false)}
                                                            options={companyPositions}
                                                            selectedValues={field.value ? [field.value] : []}
                                                            onSelect={(val) => {
                                                                field.onChange(val)
                                                                setCompanyPositionOpen(false)
                                                            }}
                                                            onAdd={handleAddPosition}
                                                            isAdding={isAddingPosition}
                                                            anchorId="company-position-trigger"
                                                            width="w-full"
                                                        />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="designation"
                                                render={({ field }) => {
                                                    const selected = field.value ? field.value.split(',').map(s => s.trim()).filter(Boolean) : []
                                                    return (
                                                        <FormItem className="relative">
                                                            <FormLabel>Designation</FormLabel>
                                                            <FormControl>
                                                                <div 
                                                                    id="designation-trigger"
                                                                    className="flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg bg-white cursor-pointer hover:border-[#0F4C75] transition-all"
                                                                    onClick={() => setDesignationOpen(!designationOpen)}
                                                                >
                                                                    <div className="flex flex-wrap gap-1 items-center flex-1 overflow-hidden">
                                                                        {selected.length > 0 ? (
                                                                            selected.map((val) => (
                                                                                <Badge key={val} variant="default" className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] py-0 h-5">
                                                                                    {val}
                                                                                    <X 
                                                                                        className="ml-1 w-3 h-3 cursor-pointer" 
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation()
                                                                                            const newVal = selected.filter(s => s !== val).join(', ')
                                                                                            field.onChange(newVal)
                                                                                        }}
                                                                                    />
                                                                                </Badge>
                                                                            ))
                                                                        ) : (
                                                                            <span className="text-sm text-slate-400">Select designations</span>
                                                                        )}
                                                                    </div>
                                                                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform flex-shrink-0", designationOpen && "rotate-180")} />
                                                                </div>
                                                            </FormControl>
                                                            <MyDropDown
                                                                isOpen={designationOpen}
                                                                onClose={() => setDesignationOpen(false)}
                                                                options={DESIGNATION_OPTIONS}
                                                                selectedValues={selected}
                                                                onSelect={(val) => {
                                                                    const newVal = selected.includes(val)
                                                                        ? selected.filter(s => s !== val).join(', ')
                                                                        : [...selected, val].join(', ')
                                                                    field.onChange(newVal)
                                                                }}
                                                                multiSelect
                                                                anchorId="designation-trigger"
                                                                width="w-full"
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )
                                                }}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="groupNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Group No</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g. G1" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="dateHired"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Date Hired</FormLabel>
                                                        <FormControl>
                                                            <Input type="date" {...field} value={field.value || ''} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                            <h4 className="text-sm font-semibold mb-4 text-slate-700">Rates & Schedule</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="hourlyRateSITE"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Hourly Rate (SITE)</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                                                    <Input type="number" className="pl-7" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="hourlyRateDrive"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Hourly Rate (Drive)</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                                                    <Input type="number" className="pl-7" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="isScheduleActive"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-white p-4 shadow-sm col-span-2">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base">Schedule Active</FormLabel>
                                                                <FormDescription>
                                                                    Employee appears in scheduling views
                                                                </FormDescription>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        {/* Separation Info - only if Inactive/Terminated */}
                                        {(form.watch("status") === "Inactive" || form.watch("status") === "Terminated") && (
                                              <div className="bg-red-50 p-6 rounded-xl border border-red-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="separationDate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-red-900">Separation Date</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" {...field} value={field.value || ''} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                 <FormField
                                                    control={form.control}
                                                    name="separationReason"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-red-900">Reason</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Reason for leaving" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                              </div>
                                        )}

                                    </div>

                                    {/* --- Tab: Files & Compliance --- */}
                                    <div className={cn(activeTab === "compliance" ? "block" : "hidden", "space-y-6 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                            {COMPLIANCE_FIELDS.map((field) => (
                                                <FormField
                                                    key={field.key}
                                                    control={form.control}
                                                    name={field.key as keyof EmployeeFormValues}
                                                    render={({ field: formField }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex justify-between items-center text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">
                                                                {field.label}
                                                            </FormLabel>
                                                            <Select onValueChange={formField.onChange} value={String(formField.value || '')}>
                                                                <FormControl>
                                                                    <SelectTrigger className={cn(
                                                                        "h-10",
                                                                         !formField.value ? "text-muted-foreground" :
                                                                         formField.value === "Yes" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                                                                         formField.value === "No" ? "bg-red-50 border-red-200 text-red-700" : 
                                                                         ""
                                                                    )}>
                                                                        <SelectValue placeholder="Select Status" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Yes"><span className="text-emerald-600 font-medium">Yes - Completed</span></SelectItem>
                                                                    <SelectItem value="No"><span className="text-red-600 font-medium">No - Missing</span></SelectItem>
                                                                    <SelectItem value="Pending"><span className="text-orange-600 font-medium">Pending</span></SelectItem>
                                                                    <SelectItem value="N/A"><span className="text-slate-400">N/A</span></SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* --- Tab: Documents --- */}
                                    <div className={cn(activeTab === "documents" ? "block" : "hidden", "space-y-6 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                                            <h4 className="text-sm font-semibold text-slate-700">Add Document</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                                                    <Input type="date" value={newDoc.date} onChange={e => setNewDoc({ ...newDoc, date: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Input placeholder="Document type" value={newDoc.type} onChange={e => setNewDoc({ ...newDoc, type: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newDoc.description} onChange={e => setNewDoc({ ...newDoc, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document Upload</label>
                                                    <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const reader = new FileReader()
                                                            reader.onloadend = () => setNewDoc({ ...newDoc, fileUrl: reader.result as string })
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }} />
                                                </div>
                                            </div>
                                            <Button type="button" size="sm" className="bg-[#0F4C75] hover:bg-[#0b3c5e] text-white" onClick={() => {
                                                if (!newDoc.date && !newDoc.type) return
                                                setDocuments([...documents, { ...newDoc }])
                                                setNewDoc({ ...emptyDoc })
                                            }}>
                                                <Plus className="w-4 h-4 mr-1" /> Add Document
                                            </Button>
                                        </div>

                                        {documents.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Saved Documents ({documents.length})</h4>
                                                {documents.map((doc, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-800 truncate">{doc.type || 'Untitled'}</p>
                                                            <p className="text-xs text-slate-400">{doc.date}{doc.description ? ` — ${doc.description}` : ''}</p>
                                                        </div>
                                                        {doc.fileUrl && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">File attached</span>}
                                                        <button type="button" onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* --- Tab: Drug Testing Records --- */}
                                    <div className={cn(activeTab === "drugTesting" ? "block" : "hidden", "space-y-6 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                                            <h4 className="text-sm font-semibold text-slate-700">Add Drug Testing Record</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                                                    <Input type="date" value={newDrug.date} onChange={e => setNewDrug({ ...newDrug, date: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newDrug.description} onChange={e => setNewDrug({ ...newDrug, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Documents (multiple allowed)</label>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        {newDrug.files.length > 0 && <span className="text-xs text-emerald-600 font-medium">{newDrug.files.length} file(s) attached ✓</span>}
                                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F4C75] hover:bg-blue-50/30 transition-all text-slate-600">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            Add File
                                                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" multiple onChange={e => {
                                                                const fileList = e.target.files;
                                                                if (fileList) {
                                                                    Array.from(fileList).forEach(file => {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            setNewDrug(prev => ({ ...prev, files: [...prev.files, reader.result as string], fileUrl: prev.fileUrl || reader.result as string }));
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    });
                                                                }
                                                                e.target.value = '';
                                                            }} />
                                                        </label>
                                                        {newDrug.files.map((_, idx) => (
                                                            <button key={idx} type="button" onClick={() => setNewDrug(prev => ({ ...prev, files: prev.files.filter((__, j) => j !== idx) }))} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                                                                Remove #{idx + 1}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button type="button" size="sm" className="bg-[#0F4C75] hover:bg-[#0b3c5e] text-white" onClick={() => {
                                                if (!newDrug.date) return
                                                setDrugRecords([...drugRecords, { ...newDrug, fileUrl: newDrug.files[0] || '' }])
                                                setNewDrug({ ...emptyDrug })
                                            }}>
                                                <Plus className="w-4 h-4 mr-1" /> Add Record
                                            </Button>
                                        </div>

                                        {drugRecords.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Saved Records ({drugRecords.length})</h4>
                                                {drugRecords.map((rec, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                                        <FlaskConical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-800 truncate">{rec.type}</p>
                                                            <p className="text-xs text-slate-400">{rec.date}{rec.description ? ` — ${rec.description}` : ''}</p>
                                                        </div>
                                                        {rec.files && rec.files.length > 0 && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{rec.files.length} file(s)</span>}
                                                        <button type="button" onClick={() => setDrugRecords(drugRecords.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* --- Tab: Training & Certifications --- */}
                                    <div className={cn(activeTab === "training" ? "block" : "hidden", "space-y-6 animate-in fade-in duration-300 slide-in-from-right-4")}>
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                                            <h4 className="text-sm font-semibold text-slate-700">Add Training / Certification</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, category: val })} value={newTraining.category}>
                                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, type: val })} value={newTraining.type}>
                                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="relative">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                                                    <div 
                                                        id="frequency-trigger"
                                                        className="flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg bg-white cursor-pointer hover:border-[#0F4C75] transition-all"
                                                        onClick={() => setFrequencyOpen(!frequencyOpen)}
                                                    >
                                                        <span className={cn("text-sm truncate", !newTraining.frequency && "text-slate-400")}>
                                                            {newTraining.frequency || "Select frequency"}
                                                        </span>
                                                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform flex-shrink-0", frequencyOpen && "rotate-180")} />
                                                    </div>
                                                    <MyDropDown
                                                        isOpen={frequencyOpen}
                                                        onClose={() => setFrequencyOpen(false)}
                                                        options={trainingFrequencies.map(f => ({ id: f, label: f, value: f }))}
                                                        selectedValues={newTraining.frequency ? [newTraining.frequency] : []}
                                                        onSelect={(val) => {
                                                            setNewTraining({ ...newTraining, frequency: val })
                                                            setFrequencyOpen(false)
                                                        }}
                                                        onAdd={async (search) => {
                                                            setIsAddingFrequency(true)
                                                            setTrainingFrequencies(prev => [...prev, search])
                                                            setNewTraining({ ...newTraining, frequency: search })
                                                            setIsAddingFrequency(false)
                                                            setFrequencyOpen(false)
                                                        }}
                                                        isAdding={isAddingFrequency}
                                                        anchorId="frequency-trigger"
                                                        width="w-full"
                                                        placeholder="Search or add frequency..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Date</label>
                                                    <Input type="date" value={newTraining.assignedDate} onChange={e => setNewTraining({ ...newTraining, assignedDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Completion Date</label>
                                                    <Input type="date" value={newTraining.completionDate} onChange={e => setNewTraining({ ...newTraining, completionDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Renewal Date</label>
                                                    <Input type="date" value={newTraining.renewalDate} onChange={e => setNewTraining({ ...newTraining, renewalDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                                    <Select onValueChange={val => setNewTraining({ ...newTraining, status: val })} value={newTraining.status}>
                                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                                        <SelectContent>
                                                            {TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                                    <Input placeholder="Brief description" value={newTraining.description} onChange={e => setNewTraining({ ...newTraining, description: e.target.value })} />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Document Upload</label>
                                                    <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const reader = new FileReader()
                                                            reader.onloadend = () => setNewTraining({ ...newTraining, fileUrl: reader.result as string })
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }} />
                                                </div>
                                            </div>
                                            <Button type="button" size="sm" className="bg-[#0F4C75] hover:bg-[#0b3c5e] text-white" onClick={() => {
                                                if (!newTraining.type && !newTraining.category) return
                                                setTrainingRecords([...trainingRecords, { ...newTraining, createdAt: new Date().toISOString() }])
                                                setNewTraining({ ...emptyTraining })
                                            }}>
                                                <Plus className="w-4 h-4 mr-1" /> Add Training
                                            </Button>
                                        </div>

                                        {trainingRecords.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold text-slate-700">Saved Records ({trainingRecords.length})</h4>
                                                {trainingRecords.map((rec, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                                        <GraduationCap className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-800 truncate">{rec.type || 'Untitled'}</p>
                                                            <p className="text-xs text-slate-400">
                                                                {rec.category}{rec.frequency ? ` · ${rec.frequency}` : ''}{rec.status ? ` · ${rec.status}` : ''}{rec.description ? ` — ${rec.description}` : ''}
                                                            </p>
                                                        </div>
                                                        {rec.status && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rec.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : rec.status === 'Expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{rec.status}</span>}
                                                        {rec.fileUrl && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">File</span>}
                                                        <button type="button" onClick={() => setTrainingRecords(trainingRecords.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                            
                            {/* Hidden submit button to allow form submission on Enter */}
                            <button type="submit" className="hidden" />
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-slate-50">
                    <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                        Cancel
                    </Button>
                    <Button 
                        onClick={form.handleSubmit(onSubmit)} 
                        disabled={isLoading} 
                        className="bg-[#0F4C75] hover:bg-[#0b3c5e] text-white min-w-[120px]"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Employee
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
