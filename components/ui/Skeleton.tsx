import { Skeleton as ShadcnSkeleton } from "@/components/ui/shadcn/skeleton"
import { cn } from "@/lib/utils"

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animation = 'pulse',
}: SkeletonProps) {
    const variantClasses = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-none',
        rounded: 'rounded-xl',
    };

    const animationClass = animation === 'none' 
        ? 'animate-none' 
        : animation === 'wave' 
            ? 'animate-shimmer bg-gradient-to-r from-accent via-white/5 to-accent bg-[length:200%_100%]' 
            : '';

    return (
        <ShadcnSkeleton
            className={cn(
                variantClasses[variant],
                animationClass,
                className
            )}
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
            }}
        />
    );
}

// Skeleton for Table Row
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-slate-50">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="p-3">
                    <Skeleton className="h-4 w-full rounded-lg" />
                </td>
            ))}
        </tr>
    );
}

// Skeleton for Card
export function SkeletonCard() {
    return (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
            </div>
        </div>
    );
}

// Skeleton for Header
export function SkeletonHeader() {
    return (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Skeleton variant="circular" className="w-10 h-10" />
                <Skeleton className="h-6 w-32" />
            </div>
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
        </div>
    );
}

// Skeleton for Table
export function SkeletonTable({ rows = 5, columns = 5, className = '' }: { rows?: number; columns?: number; className?: string }) {
    return (
        <div className={cn("bg-white/50 backdrop-blur-sm rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden", className)}>
            <table className="w-full">
                <thead className="bg-slate-50/50">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="p-4 text-left">
                                <Skeleton className="h-3 w-20 rounded-full" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Skeleton for Estimate Header Card (High-End Glassmorphism)
export function SkeletonEstimateHeader() {
    return (
        <div className="bg-white/40 backdrop-blur-md border border-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {/* Column 1: Client & Services */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-20 rounded-full" />
                        <Skeleton className="h-10 w-full rounded-2xl" />
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-3 w-16 rounded-full" />
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} variant="circular" className="w-10 h-10" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Column 2: Details & Config */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-12 rounded-full" />
                            <Skeleton className="h-8 w-full rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-12 rounded-full" />
                            <Skeleton className="h-8 w-full rounded-xl" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-24 rounded-full" />
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-20 rounded-full" />
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                </div>

                {/* Column 3: Chart Visualization */}
                <div className="flex items-center justify-center p-4">
                    <div className="relative w-44 h-44 rounded-full border-[16px] border-slate-50/50 flex items-center justify-center">
                        <Skeleton variant="circular" className="w-20 h-20" />
                    </div>
                </div>

                {/* Column 4: History Timeline */}
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton variant="circular" className="w-8 h-8 flex-shrink-0" />
                                <div className="space-y-2 flex-1 pt-1">
                                    <Skeleton className="h-3 w-full rounded-full" />
                                    <Skeleton className="h-3 w-2/3 rounded-full opacity-50" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Skeleton for Accordion Section
export function SkeletonAccordion() {
    return (
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-pulse mb-6">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-7 w-48 rounded-xl" />
                    <Skeleton className="h-6 w-20 rounded-full shadow-inner" />
                </div>
                <Skeleton className="h-10 w-32 rounded-2xl" />
            </div>
            <div className="p-6">
                <div className="space-y-6">
                    <div className="grid grid-cols-6 gap-6 pb-4 border-b border-slate-50">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Skeleton key={i} className="h-3 w-full rounded-full opacity-60" />
                        ))}
                    </div>
                    {[1, 2, 3, 4].map(row => (
                        <div key={row} className="grid grid-cols-6 gap-6 py-2">
                            {[1, 2, 3, 4, 5, 6].map(col => (
                                <Skeleton key={col} className="h-5 w-full rounded-lg" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Skeleton for Proposal Section
export function SkeletonProposal() {
    return (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm flex flex-col h-full animate-pulse overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-50 flex items-center gap-4 bg-white">
                <Skeleton className="h-8 w-40 rounded-xl" />
                <div className="flex-1" />
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
            {/* Content Area */}
            <div className="flex-1 bg-slate-50/50 p-12 overflow-y-auto flex flex-col items-center gap-12">
                {/* Visualizing Letter Pages */}
                {[1, 2].map(i => (
                    <div key={i} className="w-[8.5in] h-[11in] bg-white shadow-2xl shadow-slate-200/50 flex-shrink-0 p-20 space-y-10 rounded-sm">
                        <Skeleton className="h-10 w-1/3 rounded-xl" />
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-5/6 rounded-full" />
                        </div>
                        <Skeleton className="h-48 w-full rounded-[2rem]" />
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-4/6 rounded-full" />
                        </div>
                        <div className="pt-20">
                             <Skeleton className="h-20 w-48 rounded-2xl" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Full Composite Skeleton for Estimate Detail Page
export function FullEstimateSkeleton() {
    return (
        <div className="flex-1 overflow-y-auto min-h-0 w-full p-4 space-y-4">
            {/* Section 1: Header */}
            <SkeletonEstimateHeader />
            
            <div className="flex flex-col gap-4 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
                    {/* Section 2: Line Items (mimicking the actual layout) */}
                    <div className="md:col-span-7 pr-4">
                         <SkeletonAccordion />
                         <SkeletonAccordion />
                         <SkeletonAccordion />
                    </div>
                    {/* Section 3: Proposal Preview */}
                    <div className="md:col-span-5">
                         <div className="h-[calc(100vh-120px)] sticky top-4">
                            <SkeletonProposal />
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
