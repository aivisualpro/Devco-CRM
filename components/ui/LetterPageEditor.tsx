'use client';

import React, { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { Trash2, Plus } from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';

// Dynamically import ReactQuill with custom size registration
const ReactQuill = dynamic(
    async () => {
        const mod = await import('react-quill-new');
        const Quill = (mod.default as any).Quill || (mod as any).Quill;
        if (Quill) {
            const Size = Quill.import('attributors/style/size') as any;
            Size.whitelist = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt'];
            Quill.register(Size, true);
        }
        return mod.default;
    },
    { ssr: false, loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" /> }
) as any;

interface LetterPageEditorProps {
    pages: { content: string }[];
    onPagesChange: (pages: { content: string }[]) => void;
    quillRefs?: React.MutableRefObject<any[]>;
    showAddPage?: boolean;
    showDeletePage?: boolean;
    readOnly?: boolean;
    hideToolbar?: boolean;
}

// Quill toolbar modules with length restriction
const quillModules = (maxLength: number = 3000) => ({
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'],
        ['clean']
    ],
    history: {
        delay: 1000,
        maxStack: 50,
        userOnly: true
    },
    clipboard: {
        matchVisual: false
    }
});

// Single Letter Page Component
interface LetterPageProps {
    index: number;
    content: string;
    onChange: (value: string) => void;
    onDelete?: () => void;
    showDelete?: boolean;
    quillRef?: (el: any) => void;
    readOnly?: boolean;
    hideToolbar?: boolean;
}

function LetterPage({ index, content, onChange, onDelete, showDelete, quillRef, readOnly, hideToolbar }: LetterPageProps) {
    return (
        <div className="relative flex flex-col items-center">
            {/* Page Header (Subtle Side Indicator) */}
            <div className="absolute -left-12 top-2 select-none">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest vertical-text" style={{ writingMode: 'vertical-rl' }}>
                    P{index + 1}
                </span>
            </div>

            {showDelete && !readOnly && (
                <button
                    onClick={onDelete}
                    className="absolute -right-10 top-2 p-2 text-gray-300 hover:text-red-500 transition-colors z-20"
                    title="Delete Page"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            )}

            {/* Page Container - Letter Size (8.5" x 11") + Toolbar */}
            <div
                className="bg-white relative flex-shrink-0 flex flex-col"
                style={{
                    width: '8.5in',
                    /* IMPORTANT: The toolbar height (44px) + 11in content height */
                    height: !readOnly && !hideToolbar ? 'calc(11in + 44px)' : '11in',
                    minWidth: '8.5in',
                    minHeight: !readOnly && !hideToolbar ? 'calc(11in + 44px)' : '11in',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 1px 8px rgba(0,0,0,0.05)',
                    borderRadius: '2px',
                    overflow: 'hidden' // Changed from 'visible' to 'hidden' to clip content
                }}
            >
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={content}
                    onChange={(value: string) => {
                        // Create a temporary element to measure content height
                        if (typeof document !== 'undefined') {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = value;
                            tempDiv.style.cssText = `
                                position: absolute;
                                visibility: hidden;
                                width: 7.5in; /* 8.5in - 1in padding */
                                font-family: Arial, sans-serif;
                                font-size: 11pt;
                                line-height: 1.15;
                                padding: 0;
                                margin: 0;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                            `;
                            document.body.appendChild(tempDiv);

                            const contentHeight = tempDiv.scrollHeight;
                            const maxHeightPx = 11 * 96; // 11 inches in pixels at 96 DPI

                            document.body.removeChild(tempDiv);

                            // If content would exceed page height, don't allow the change
                            if (contentHeight > maxHeightPx && value.length > content.length) {
                                return; // Block the change
                            }
                        }

                        // Also check character count as backup
                        const textLength = value.replace(/<[^>]*>/g, '').length;
                        if (textLength > 3000 && value.length > content.length) {
                            return; // Block excessive character count
                        }

                        onChange(value);
                    }}
                    readOnly={readOnly}
                    modules={readOnly || hideToolbar ? { toolbar: false } : quillModules()}
                    className="h-full flex flex-col [&_.ql-container]:flex-1 [&_.ql-container]:border-none [&_.ql-container]:overflow-hidden [&_.ql-toolbar]:flex-shrink-0"
                    style={{ height: '100%' }}
                    preserveWhitespace={true}
                />
            </div>
        </div>
    );
}

// Main Letter Page Editor Component
export function LetterPageEditor({ 
    pages, 
    onPagesChange, 
    quillRefs,
    showAddPage = true,
    showDeletePage = true,
    readOnly = false,
    hideToolbar = false
}: LetterPageEditorProps) {
    
    const handlePageContentChange = (index: number, value: string) => {
        const newPages = [...pages];
        newPages[index] = { content: value };
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
        <div className="flex flex-col gap-6 items-center origin-top-center pb-8">
            {pages.map((page, index) => (
                <LetterPage
                    key={index}
                    index={index}
                    content={page.content}
                    onChange={(val) => handlePageContentChange(index, val)}
                    onDelete={() => handleRemovePage(index)}
                    showDelete={showDeletePage && index > 0}
                    quillRef={quillRefs ? (el: any) => { quillRefs.current[index] = el; } : undefined}
                    readOnly={readOnly}
                    hideToolbar={hideToolbar}
                />
            ))}

            {/* Add New Page Button */}
            {showAddPage && !readOnly && (
                <button
                    onClick={handleAddPage}
                    className="mb-12 flex items-center gap-3 px-8 py-4 rounded-full text-gray-500 hover:text-blue-600 font-medium transition-all active:scale-[0.98]"
                    style={{ background: '#e0e5ec', boxShadow: '8px 8px 16px #b8b9be, -8px -8px 16px #ffffff' }}
                >
                    <Plus className="w-5 h-5" />
                    <span>Add New Page</span>
                </button>
            )}

            {/* Global styles for Quill editor */}
            <style jsx global>{`
                /* --- ULTRA-PREMIUM TOOLBAR (Shared) --- */
                .ql-toolbar.ql-snow {
                    position: sticky !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    z-index: 100 !important;
                    background: #ffffff !important;
                    height: 44px !important; /* Fixed height for single row */
                    display: flex !important;
                    flex-wrap: nowrap !important; /* Force single row */
                    align-items: center !important;
                    padding: 0 8px !important;
                    border: none !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02) !important;
                    gap: 2px !important;
                    white-space: nowrap !important;
                }

                /* Hide Scrollbars */
                .ql-toolbar.ql-snow::-webkit-scrollbar { display: none; }
                
                /* Compact Groups */
                .ql-toolbar.ql-snow .ql-formats {
                    display: flex !important;
                    align-items: center !important;
                    margin-right: 8px !important;
                    padding-right: 8px !important;
                    border-right: 1px solid #f1f5f9 !important;
                    gap: 2px !important;
                }
                .ql-toolbar.ql-snow .ql-formats:last-child {
                    border-right: none !important;
                    margin-right: 0 !important;
                    padding-right: 0 !important;
                }

                /* Buttons */
                .ql-toolbar.ql-snow button {
                    width: 28px !important;
                    height: 28px !important;
                    padding: 4px !important;
                    border-radius: 4px !important;
                    color: #64748b !important;
                    transition: all 0.15s ease !important;
                }
                .ql-toolbar.ql-snow button:hover {
                    background-color: #f1f5f9 !important;
                    color: #0f172a !important;
                }
                .ql-toolbar.ql-snow button.ql-active {
                    background-color: #eff6ff !important;
                    color: #2563eb !important;
                }
                
                /* Icon SVG tweaks */
                .ql-toolbar.ql-snow .ql-stroke {
                    stroke-width: 2 !important;
                    stroke: currentColor !important;
                }
                .ql-toolbar.ql-snow .ql-fill {
                    fill: currentColor !important;
                }

                /* Compact Pickers (Dropdowns) */
                .ql-toolbar.ql-snow .ql-picker {
                    height: 28px !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .ql-toolbar.ql-snow .ql-picker-label {
                    padding: 0 8px !important;
                    border: 1px solid transparent !important;
                    border-radius: 4px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    color: #475569 !important;
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .ql-toolbar.ql-snow .ql-picker-label:hover {
                    background-color: #f8fafc !important;
                    border-color: #e2e8f0 !important;
                }
                
                /* Picker Widths */
                .ql-toolbar.ql-snow .ql-picker.ql-header { width: 85px !important; }
                .ql-toolbar.ql-snow .ql-picker.ql-size { width: 60px !important; }
                
                /* Editor Content with 0.5in Margin - STRICT PAGE LIMIT */
                .ql-container.ql-snow .ql-editor {
                    padding: 48px !important; /* 0.5 inches */
                    width: 100% !important;
                    box-sizing: border-box !important;
                    font-family: Arial, sans-serif !important;
                    font-size: 11pt !important;
                    line-height: 1.15 !important;
                    height: 11in !important; /* Fixed height - no min/max, just exact */
                    overflow: hidden !important; /* No scrolling allowed */
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                }

                /* Prevent content from exceeding container */
                .ql-container.ql-snow .ql-editor * {
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }

                .ql-container.ql-snow .ql-editor p,
                .ql-container.ql-snow .ql-editor div,
                .ql-container.ql-snow .ql-editor span {
                    max-width: 100% !important;
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                }
                
                /* Ensure tables and content respect the margin */
                .ql-editor > * {
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                .ql-editor table {
                    width: 100% !important;
                    max-width: 100% !important;
                    table-layout: fixed !important; 
                }
                .ql-editor img {
                    max-width: 100% !important;
                    height: auto !important;
                }

                /* Table Cell Styling */
                .ql-editor td, .ql-editor th {
                    padding: 3px 6px !important;
                    border-color: #cbd5e1 !important;
                    word-wrap: break-word !important; 
                }

                /* Custom Font Sizes */
                .ql-editor .ql-size-8pt { font-size: 8pt !important; }
                .ql-editor .ql-size-9pt { font-size: 9pt !important; }
                .ql-editor .ql-size-10pt { font-size: 10pt !important; }
                .ql-editor .ql-size-11pt { font-size: 11pt !important; } 
                .ql-editor .ql-size-12pt { font-size: 12pt !important; }
                .ql-editor .ql-size-14pt { font-size: 14pt !important; }
                
                /* Picker Label Overrides */
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="8pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="8pt"]::before { content: '8pt'; }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="9pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="9pt"]::before { content: '9pt'; }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10pt"]::before { content: '10pt'; }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="11pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="11pt"]::before { content: '11pt'; }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12pt"]::before { content: '12pt'; }
                .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14pt"]::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14pt"]::before { content: '14pt'; }

                .ql-editor p {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
            `}</style>
        </div>
    );
}

