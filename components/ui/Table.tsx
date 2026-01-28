'use client';

import React from 'react';

interface TableProps {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    footer?: React.ReactNode;
}

export function Table({ children, className = '', containerClassName = 'h-[calc(100vh-170px)] min-h-[400px]', footer }: TableProps) {
    return (
        <div className={`rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden ${containerClassName}`}>
            <div className="flex-1 overflow-auto">
                <table className={`w-full text-xs ${className}`}>
                    {children}
                </table>
            </div>
            {footer && (
                <div className="flex-none border-t border-gray-100">
                    {footer}
                </div>
            )}
        </div>
    );
}

interface TableHeadProps {
    children: React.ReactNode;
    className?: string;
}

export function TableHead({ children, className = '' }: TableHeadProps) {
    return (
        <thead className={`bg-[#f9fafb] sticky top-0 z-10 border-b border-gray-200 ${className}`}>
            {children}
        </thead>
    );
}

interface TableBodyProps {
    children: React.ReactNode;
    className?: string;
}

export function TableBody({ children, className = '' }: TableBodyProps) {
    return <tbody className={`divide-y divide-gray-100 bg-white ${className}`}>{children}</tbody>;
}

interface TableRowProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function TableRow({ children, className = '', onClick }: TableRowProps) {
    return (
        <tr
            className={`hover:bg-gray-50/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </tr>
    );
}

interface TableHeaderProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    sortable?: boolean;
    sortDirection?: 'asc' | 'desc' | null;
}

export function TableHeader({ children, className = '', onClick, sortable, sortDirection }: TableHeaderProps) {
    const isCentered = className.includes('text-center');
    return (
        <th
            className={`p-1 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider bg-[#f9fafb] ${onClick || sortable ? 'cursor-pointer hover:bg-white select-none transition-colors group' : ''} ${className}`}
            onClick={onClick}
        >
            <div className={`flex items-center gap-1 ${isCentered ? 'justify-center' : ''}`}>
                {children}
                {(sortable || sortDirection) && (
                    <span className="flex flex-col">
                        {/* Up Arrow */}
                        <svg
                            className={`w-2 h-2 ${sortDirection === 'asc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`}
                            fill="currentColor" viewBox="0 0 24 24"
                        >
                            <path d="M7 14l5-5 5 5z" />
                        </svg>
                        {/* Down Arrow */}
                        <svg
                            className={`w-2 h-2 -mt-0.5 ${sortDirection === 'desc' ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`}
                            fill="currentColor" viewBox="0 0 24 24"
                        >
                            <path d="M7 10l5 5 5-5z" />
                        </svg>
                    </span>
                )}
            </div>
        </th>
    );
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    children: React.ReactNode;
    className?: string;
    colSpan?: number;
    rowSpan?: number;
}

export function TableCell({ children, className = '', colSpan, rowSpan, ...props }: TableCellProps) {
    return (
        <td
            colSpan={colSpan}
            rowSpan={rowSpan}
            className={`p-1 text-xs text-gray-600 whitespace-nowrap ${className}`}
            {...props}
        >
            {children}
        </td>
    );
}

export default Table;
