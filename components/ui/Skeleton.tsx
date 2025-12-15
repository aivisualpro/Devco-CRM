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
        rounded: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer',
        none: '',
    };

    const combinedClassName = [
        'bg-gray-200',
        variantClasses[variant],
        animationClasses[animation],
        className
    ].filter(Boolean).join(' ');

    return (
        <div
            className={combinedClassName}
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
        <tr className="border-b border-gray-100">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="p-3">
                    <Skeleton className="h-4 w-full" />
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
export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
    return (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="p-3 text-left">
                                <Skeleton className="h-4 w-24" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Skeleton for Estimate Header Card
export function SkeletonEstimateHeader() {
    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-8 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {/* Customer + Services */}
                <div className="flex flex-col gap-6 p-4 rounded-2xl bg-white/30">
                    <div>
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                    <div>
                        <Skeleton className="h-3 w-16 mb-3" />
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} variant="circular" className="w-12 h-12" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Date/Project + Markup/Fringe */}
                <div className="flex flex-col gap-5 p-4 rounded-2xl bg-white/30">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Skeleton className="h-3 w-12 mb-1" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                        <div className="flex-1">
                            <Skeleton className="h-3 w-20 mb-1" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </div>
                    <div>
                        <Skeleton className="h-3 w-16 mb-2" />
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                    <div>
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                </div>

                {/* Chart */}
                <div className="p-4 rounded-2xl bg-white/30">
                    <Skeleton variant="circular" className="w-48 h-48 mx-auto" />
                </div>

                {/* Version Timeline */}
                <div className="p-4 rounded-2xl bg-white/30">
                    <Skeleton className="h-4 w-32 mb-4" />
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton variant="circular" className="w-8 h-8" />
                                <div className="flex-1">
                                    <Skeleton className="h-3 w-full mb-1" />
                                    <Skeleton className="h-3 w-2/3" />
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton variant="circular" className="w-6 h-6" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="p-4">
                <SkeletonTable rows={3} columns={6} />
            </div>
        </div>
    );
}
