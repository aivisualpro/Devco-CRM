'use client';

import React from 'react';

interface TableProps {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
}

export function Table({ children, className = '', containerClassName = '' }: TableProps) {
    return (
        <div className={`rounded-xl border border-gray-200 bg-white overflow-auto ${containerClassName}`}>
            <table className={`w-full text-xs ${className}`}>
                {children}
            </table>
        </div>
    );
}

interface TableHeadProps {
    children: React.ReactNode;
}

export function TableHead({ children }: TableHeadProps) {
    return (
        <thead className="bg-[#f9fafb] sticky top-0 z-10 border-b border-gray-200">
            {children}
        </thead>
    );
}

interface TableBodyProps {
    children: React.ReactNode;
}

export function TableBody({ children }: TableBodyProps) {
    return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>;
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
}

export function TableHeader({ children, className = '', onClick }: TableHeaderProps) {
    return (
        <th
            className={`px-4 py-1.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider bg-[#f9fafb] ${onClick ? 'cursor-pointer hover:bg-white select-none transition-colors' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </th>
    );
}

interface TableCellProps {
    children: React.ReactNode;
    className?: string;
    colSpan?: number;
    rowSpan?: number;
}

export function TableCell({ children, className = '', colSpan, rowSpan }: TableCellProps) {
    return (
        <td
            colSpan={colSpan}
            rowSpan={rowSpan}
            className={`px-4 py-1.5 text-xs text-gray-600 whitespace-nowrap ${className}`}
        >
            {children}
        </td>
    );
}

export default Table;
