'use client';

import React, { useRef, MutableRefObject } from 'react';
import dynamic from 'next/dynamic';
import { Plus, X } from 'lucide-react';
import { Skeleton } from '@/components/ui';

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor').then(mod => mod.RichTextEditor), { 
    ssr: false, 
    loading: () => <Skeleton className="h-40 w-full" /> 
});

interface Page {
    content: string;
}

interface MyTemplateProps {
    pages: Page[];
    onPagesChange: (pages: Page[]) => void;
    quillRefs?: MutableRefObject<any[]>;
    showAddPage?: boolean;
    showDeletePage?: boolean;
    showPageIndicator?: boolean;
    scale?: number;
    className?: string;
}


export function MyTemplate({
    pages,
    onPagesChange,
    quillRefs,
    showAddPage = true,
    showDeletePage = true,
    showPageIndicator = false,
    scale = 1,
    className = ''
}: MyTemplateProps) {
    const localRefs = useRef<any[]>([]);
    const refs = quillRefs || localRefs;

    const handlePageContentChange = (index: number, val: string) => {
        const newPages = [...pages];
        newPages[index] = { content: val };
        onPagesChange(newPages);
    };

    const handleAddPage = () => {
        onPagesChange([...pages, { content: '' }]);
    };

    const handleRemovePage = (index: number) => {
        if (pages.length <= 1) return;
        onPagesChange(pages.filter((_, i) => i !== index));
    };

    return (
        <>
            {/* Quill Editor Styles - matches template page exactly */}
            <style>{`
                /* Toolbar - compact but touch-friendly */
                .my-template-editor .ql-toolbar.ql-snow {
                    background: white !important;
                    border: none !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 12px 16px !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                    position: sticky !important;
                    top: 0 !important;
                    z-index: 10 !important;
                }
                
                /* Button styling - bigger touch targets */
                .my-template-editor .ql-toolbar.ql-snow button {
                    width: 36px !important;
                    height: 36px !important;
                    padding: 0 !important;
                    border-radius: 8px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow button svg {
                    width: 20px !important;
                    height: 20px !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow .ql-stroke {
                    stroke-width: 2px !important;
                }
                
                /* Picker styling */
                .my-template-editor .ql-toolbar.ql-snow .ql-picker {
                    height: 36px !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow .ql-picker-label {
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    display: flex !important;
                    align-items: center !important;
                    height: 36px !important;
                    border: 1px solid #e5e7eb !important;
                    background: white !important;
                }
                
                /* Hover states */
                .my-template-editor .ql-toolbar.ql-snow button:hover {
                    background: #e5e7eb !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow button.ql-active {
                    background: #dbeafe !important;
                    color: #2563eb !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow button.ql-active .ql-stroke {
                    stroke: #2563eb !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow button.ql-active .ql-fill {
                    fill: #2563eb !important;
                }
                
                /* Dropdown styling */
                .my-template-editor .ql-toolbar.ql-snow .ql-picker-options {
                    background: white !important;
                    border-radius: 8px !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
                    padding: 6px !important;
                    border: 1px solid #e5e7eb !important;
                    margin-top: 4px !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow .ql-picker-item {
                    padding: 8px 12px !important;
                    border-radius: 6px !important;
                    font-size: 13px !important;
                }
                
                .my-template-editor .ql-toolbar.ql-snow .ql-picker-item:hover {
                    background: #f3f4f6 !important;
                }
                
                /* Editor content area - 0.5 inch margins */
                .my-template-editor .ql-container.ql-snow .ql-editor {
                    padding: 0.5in !important;
                    font-size: 11pt !important;
                    line-height: 1.4 !important;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                    min-height: calc(11in - 38px) !important;
                    overflow: hidden !important;
                }
                
                /* Make bullets more visible */
                .my-template-editor .ql-container.ql-snow .ql-editor ul,
                .my-template-editor .ql-container.ql-snow .ql-editor ol {
                    padding-left: 1.5em !important;
                }
                
                .my-template-editor .ql-container.ql-snow .ql-editor ul li::before {
                    content: '•' !important;
                    font-size: 1.2em !important;
                    font-weight: bold !important;
                    color: #374151 !important;
                    margin-right: 0.5em !important;
                }
                
                .my-template-editor .ql-container.ql-snow .ql-editor ul li {
                    list-style-type: none !important;
                    padding-left: 0 !important;
                }
            `}</style>

            <div className={`flex flex-col gap-8 items-center pb-12 ${className}`} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
                {pages.map((page, index) => (
                    <div key={index} className="relative flex flex-col items-center">
                        {/* Page Indicator (Optional) */}
                        {showPageIndicator && (
                            <div className="absolute -left-12 top-2 select-none">
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                    P{index + 1}
                                </span>
                            </div>
                        )}

                        {/* Delete Page Button */}
                        {showDeletePage && index > 0 && (
                            <button
                                onClick={() => handleRemovePage(index)}
                                className="absolute -right-10 top-2 p-2 text-gray-300 hover:text-red-500 transition-colors z-20"
                                title="Delete Page"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {/* Page Container - Exact Letter Size */}
                        <div
                            className="bg-white relative flex-shrink-0 flex flex-col my-template-editor"
                            style={{
                                width: '8.5in',
                                height: 'calc(11in + 38px)',
                                minWidth: '8.5in',
                                minHeight: 'calc(11in + 38px)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 1px 8px rgba(0,0,0,0.05)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                            }}
                        >
                            <RichTextEditor
                                ref={(el: any) => { refs.current[index] = el; }}
                                value={page.content}
                                onChange={(val: string) => handlePageContentChange(index, val)}
                            />
                        </div>
                    </div>
                ))}

                {/* Add New Page Button */}
                {showAddPage && (
                    <button
                        onClick={handleAddPage}
                        className="flex items-center gap-3 px-8 py-4 rounded-full text-gray-500 hover:text-blue-600 font-medium transition-all active:scale-[0.98]"
                        style={{ background: '#e0e5ec', boxShadow: '8px 8px 16px #b8b9be, -8px -8px 16px #ffffff' }}
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add New Page</span>
                    </button>
                )}
            </div>
        </>
    );
}
