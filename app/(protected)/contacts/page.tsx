'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Phone, Mail, MessageSquare, Search } from 'lucide-react';
import { Header, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, SkeletonTable, Badge, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';

interface Employee {
    _id: string; // email as id usually
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    mobile?: string;
    companyPosition?: string;
    profilePicture?: string;
    status: string;
}

export default function ContactsPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleCount, setVisibleCount] = useState(20);
    const itemsPerPage = 15;
    const observerTarget = useRef(null);

    useEffect(() => {
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
        fetchEmployees();
    }, []);

    const filteredEmployees = useMemo(() => {
        return employees.filter(c => {
            if (search) {
                const lowerSearch = search.toLowerCase();
                return (
                    (c.firstName || '').toLowerCase().includes(lowerSearch) ||
                    (c.lastName || '').toLowerCase().includes(lowerSearch) ||
                    (c.email || '').toLowerCase().includes(lowerSearch) ||
                    (c.companyPosition || '').toLowerCase().includes(lowerSearch)
                );
            }
            return true;
        }).sort((a, b) => {
            const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
            const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }, [employees, search]);

    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const mobileEmployees = filteredEmployees.slice(0, visibleCount);
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

    // Infinite scroll for mobile
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

    useEffect(() => {
        setCurrentPage(1);
        setVisibleCount(20);
    }, [search]);

    const formatPhone = (val?: string) => {
        if (!val) return '-';
        return val.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
             <div className="flex-none">
                <Header
                    hideLogo={false}
                    rightContent={
                        <div className="flex items-center justify-end flex-1">
                            <SearchInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search contacts..."
                            />
                        </div>
                    }
                />
            </div>

            <div className="flex-1 flex flex-col min-h-0 p-4">
                {loading ? (
                     <>
                        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                            ))}
                        </div>
                        <div className="hidden md:block h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
                            <div className="space-y-4">
                                <div className="h-8 bg-slate-100 rounded w-1/3 animate-pulse" />
                                <div className="space-y-2">
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                         {/* Mobile Card View */}
                         <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                            {mobileEmployees.length === 0 ? (
                                <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-slate-500 font-medium">No contacts found</p>
                                </div>
                            ) : (
                                mobileEmployees.map((emp) => (
                                    <div key={emp._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                                            {emp.profilePicture ? (
                                                <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                (emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm truncate">{emp.firstName} {emp.lastName}</h3>
                                            <p className="text-xs text-slate-500 truncate mb-2">{emp.companyPosition || 'No Position'}</p>
                                            
                                            <div className="flex items-center gap-4">
                                                {emp.mobile && (
                                                    <a href={`tel:${emp.mobile}`} className="text-slate-400 hover:text-emerald-500 transition-colors">
                                                        <Phone size={14} />
                                                    </a>
                                                )}
                                                {emp.mobile && (
                                                    <a href={`sms:${emp.mobile}`} className="text-slate-400 hover:text-blue-500 transition-colors">
                                                        <MessageSquare size={14} />
                                                    </a>
                                                )}
                                                {emp.email && (
                                                   <a href={`mailto:${emp.email}`} className="text-slate-400 hover:text-purple-500 transition-colors">
                                                        <Mail size={14} />
                                                    </a> 
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={observerTarget} className="h-4 col-span-full" />
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 h-full">
                            <Table
                                containerClassName="h-full"
                                footer={
                                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                                }
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableHeader>Name</TableHeader>
                                        <TableHeader>Email</TableHeader>
                                        <TableHeader>Mobile</TableHeader>
                                        <TableHeader className="text-right">Contact</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedEmployees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                                                No contacts found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedEmployees.map((emp) => (
                                            <TableRow key={emp._id} className="hover:bg-slate-50/50">
                                                <TableCell className="font-medium text-slate-900">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold overflow-hidden border border-slate-200">
                                                            {emp.profilePicture ? (
                                                                <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                (emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold">{emp.firstName} {emp.lastName}</p>
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{emp.companyPosition}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600">
                                                    {emp.email || '-'}
                                                </TableCell>
                                                 <TableCell className="text-slate-600 font-medium">
                                                    {formatPhone(emp.mobile)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                         {emp.mobile ? (
                                                            <>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <a 
                                                                            href={`tel:${emp.mobile}`}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                                                                        >
                                                                            <Phone size={14} />
                                                                        </a>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Call</TooltipContent>
                                                                </Tooltip>
                                                                
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <a 
                                                                            href={`sms:${emp.mobile}`}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                                                                        >
                                                                            <MessageSquare size={14} />
                                                                        </a>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>SMS</TooltipContent>
                                                                </Tooltip>
                                                            </>
                                                         ): (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 cursor-not-allowed">
                                                                    <Phone size={14} />
                                                                </div>
                                                                 <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 cursor-not-allowed">
                                                                    <MessageSquare size={14} />
                                                                </div>
                                                            </>
                                                         )}

                                                        {emp.email ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <a 
                                                                        href={`mailto:${emp.email}`}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 transition-all shadow-sm"
                                                                    >
                                                                        <Mail size={14} />
                                                                    </a>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Email</TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                             <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 cursor-not-allowed">
                                                                <Mail size={14} />
                                                            </div>
                                                        )}
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
        </div>
    );
}
