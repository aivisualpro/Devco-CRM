'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Copy, Info } from 'lucide-react';

export interface LineItemColumnConfig {
    key: string;
    header: string;
    type: 'text' | 'number' | 'currency' | 'percent' | 'select' | 'readonly';
    editable: boolean;
    computed?: (row: any, allRows: any[]) => any;
    options?: string[]; // for select
    align?: 'left' | 'right' | 'center';
    width?: string;
    placeholder?: string;
    render?: (row: any, val: any) => React.ReactNode;
}

export interface GenericLineItemsTableProps {
    columns: LineItemColumnConfig[];
    rows: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
    onAction?: (item: any, actionType: string) => void; // for explain
    emptyMessage?: string;
}

function LiveInput({
    value,
    inputType,
    onChange,
    onBlur,
    placeholder = "",
    inputId = ""
}: {
    value: string;
    inputType: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    placeholder?: string;
    inputId?: string;
}) {
    const isFocused = useRef(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();

            const currentInput = e.currentTarget;
            const allInputs = Array.from(
                document.querySelectorAll('input[data-input-id], select')
            ).filter(el => !el.hasAttribute('disabled')) as HTMLElement[];

            const currentIndex = allInputs.indexOf(currentInput);

            if (e.shiftKey) {
                if (currentIndex > 0) {
                    setTimeout(() => allInputs[currentIndex - 1].focus(), 0);
                }
            } else {
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    setTimeout(() => allInputs[currentIndex + 1].focus(), 0);
                }
            }
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        delete document.body.dataset.inputFocused;
        onBlur();
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = true;
        e.target.select();
        document.body.dataset.inputFocused = 'true';
    };

    return (
        <input
            type={inputType}
            value={value}
            data-input-id={inputId}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder={placeholder}
            className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left text-slate-600 shadow-sm"
        />
    );
}

function GenericRow({
    row,
    index,
    allRows,
    columns,
    onUpdateItem,
    onDelete,
    onDuplicate,
    onAction
}: {
    row: any;
    index: number;
    allRows: any[];
    columns: LineItemColumnConfig[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
    onAction?: (item: any, actionType: string) => void;
}) {
    // Initialize local values from row
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        const newLocal: Record<string, string> = {};
        columns.forEach(col => {
            if (col.editable) {
                newLocal[col.key] = dirtyFields.has(col.key) ? (localValues[col.key] || '') : String(row[col.key] ?? '');
            }
        });
        setLocalValues(newLocal);
    }, [row, columns]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string, colType: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field];
            const numericTypes = ['number', 'currency', 'percent'];
            const finalValue = numericTypes.includes(colType) ? (parseFloat(value) || 0) : value;
            onUpdateItem?.(row, field, finalValue);
            setDirtyFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(field);
                return newSet;
            });
        }
    };

    const formatCurrency = (val: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(val);
    };

    const formatPercent = (val: number): string => {
        if (isNaN(val)) return '--';
        return `${val}%`;
    };

    return (
        <tr className="hover:bg-gray-50/50 transition-colors group">
            <td className="p-1 text-xs text-gray-400 text-center font-medium">
                {index + 1}
            </td>
            <td className="p-0.5 w-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate?.(row);
                    }}
                    className="text-gray-300 hover:text-blue-600 transition-colors p-1"
                    title="Duplicate Row"
                >
                    <Copy className="w-3 h-3" />
                </button>
            </td>
            {columns.map((col, cIdx) => {
                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                let content: React.ReactNode = null;

                if (col.editable) {
                    if (col.type === 'select' && col.options) {
                        content = (
                            <select
                                value={localValues[col.key] ?? ''}
                                onChange={(e) => {
                                    handleChange(col.key, e.target.value);
                                    onUpdateItem?.(row, col.key, e.target.value);
                                }}
                                className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-left"
                            >
                                {col.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        );
                    } else {
                        content = (
                            <LiveInput
                                value={localValues[col.key] ?? ''}
                                inputType={col.type === 'number' || col.type === 'currency' || col.type === 'percent' ? 'number' : 'text'}
                                onChange={(val) => handleChange(col.key, val)}
                                onBlur={() => handleBlur(col.key, col.type)}
                                placeholder={col.placeholder || col.header}
                                inputId={`row-${index}-${col.key}`}
                            />
                        );
                    }
                } else if (col.computed) {
                    // Inject local values so computed reflects live unsaved edits
                    const liveRow = { ...row };
                    columns.forEach(c => {
                        if (c.editable && localValues[c.key] !== undefined) {
                            const val = localValues[c.key];
                            const numericTypes = ['number', 'currency', 'percent'];
                            liveRow[c.key] = numericTypes.includes(c.type) ? (parseFloat(val) || 0) : val;
                        }
                    });

                    const computedVal = col.computed(liveRow, allRows);
                    
                    if (col.render) {
                        content = col.render(liveRow, computedVal);
                    } else if (col.type === 'currency') {
                        content = <span className="font-bold text-gray-700">{formatCurrency(computedVal)}</span>;
                    } else if (col.type === 'percent') {
                        content = <span className="text-gray-700">{formatPercent(computedVal)}</span>;
                    } else {
                        content = <span className="text-gray-700">{computedVal}</span>;
                    }
                } else if (col.render) {
                    content = col.render(row, row[col.key]);
                } else {
                    const rawVal = row[col.key];
                    if (col.type === 'currency') {
                        content = <span className="text-gray-700">{formatCurrency(parseFloat(rawVal) || 0)}</span>;
                    } else if (col.type === 'percent') {
                        content = <span className="text-gray-700">{formatPercent(parseFloat(rawVal) || 0)}</span>;
                    } else {
                        content = <span className="text-gray-700">{rawVal}</span>;
                    }
                }

                return (
                    <td key={col.key} className={`p-1 text-xs ${alignClass}`} style={col.width ? { width: col.width } : undefined}>
                        {content}
                    </td>
                );
            })}
            <td className="p-1 text-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(row);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                    title="Delete Item"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </td>
        </tr>
    );
}

export function GenericLineItemsTable({
    columns,
    rows,
    onUpdateItem,
    onDelete,
    onDuplicate,
    onAction,
    emptyMessage = "No items found."
}: GenericLineItemsTableProps) {
    if (!rows || rows.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto p-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8">
                            #
                        </th>
                        <th className="p-1 w-4" />
                        {columns.map(col => (
                            <th 
                                key={col.key} 
                                className={`p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                                style={col.width ? { width: col.width } : undefined}
                            >
                                {col.header}
                            </th>
                        ))}
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                        <GenericRow
                            key={`${row._id || 'row'}-${i}`}
                            row={row}
                            index={i}
                            allRows={rows}
                            columns={columns}
                            onUpdateItem={onUpdateItem}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                            onAction={onAction}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
