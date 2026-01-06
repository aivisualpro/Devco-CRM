import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Template {
    _id: string;
    title: string;
}

interface TemplateSelectorProps {
    templates: Template[];
    selectedId: string;
    onSelect: (id: string) => void;
    disabled?: boolean;
}

const COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
];

const getColor = (id: string, index: number) => {
    return COLORS[index % COLORS.length];
};

export function TemplateSelector({ templates, selectedId, onSelect, disabled }: TemplateSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTemplates = templates.filter(t => 
        t.title.toLowerCase().includes(search.toLowerCase())
    );

    const selectedTemplate = templates.find(t => t._id === selectedId);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                    disabled:opacity-50 min-w-[200px] flex items-center justify-between
                    text-gray-700
                `}
            >
                <span className="truncate">
                    {selectedTemplate ? selectedTemplate.title : 'Select Template...'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-[300px] bg-[#F4F6F8] rounded-2xl shadow-xl border border-white/50 ring-1 ring-black/5 z-50 overflow-hidden backdrop-blur-sm">
                    {/* Search - Sticky Top */}
                    <div className="p-3 bg-white/50 backdrop-blur-md border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search templates..."
                                className="w-full pl-9 pr-3 py-2 bg-white border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-400"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-2">
                        {/* None Option */}
                        <button
                            onClick={() => {
                                onSelect('');
                                setIsOpen(false);
                            }}
                            className="w-full text-center py-3 mb-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all font-semibold text-gray-700 hover:text-gray-900 mx-auto block"
                        >
                            None
                        </button>

                        <div className="space-y-1">
                            {filteredTemplates.length > 0 ? (
                                filteredTemplates.map((template, idx) => {
                                    const color = getColor(template._id, idx);
                                    const isSelected = template._id === selectedId;

                                    return (
                                        <button
                                            key={template._id}
                                            onClick={() => {
                                                onSelect(template._id);
                                                setIsOpen(false);
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                                                ${isSelected ? 'bg-white shadow-sm ring-1 ring-blue-500/10' : 'hover:bg-white/60'}
                                            `}
                                        >
                                            <div 
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className={`text-sm font-semibold truncate flex-1 text-left ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {template.title}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-blue-600" />
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                                    No templates found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
