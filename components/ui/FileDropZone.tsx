'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

export interface UploadedFile {
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: string;
    size?: number;
    isPdf?: boolean;
    r2Key?: string;
}

interface FileDropZoneProps {
    onFilesUploaded: (files: UploadedFile[]) => void;
    existingFiles?: UploadedFile[];
    onRemoveFile?: (index: number) => void;
    folder?: string;
    multiple?: boolean;
    accept?: string;
    disabled?: boolean;
    label?: string;
    sublabel?: string;
    className?: string;
    compact?: boolean;
}

export function FileDropZone({
    onFilesUploaded,
    existingFiles = [],
    onRemoveFile,
    folder = 'uploads',
    multiple = true,
    accept,
    disabled = false,
    label = 'Click to upload or drag and drop',
    sublabel = 'Images, PDFs & Documents',
    className = '',
    compact = false,
}: FileDropZoneProps) {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFiles = useCallback(async (fileList: File[]) => {
        if (fileList.length === 0 || disabled) return;

        setUploading(true);
        const uploaded: UploadedFile[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            setUploadProgress(`Uploading ${i + 1} of ${fileList.length}...`);

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', folder);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error(`Upload failed for ${file.name}:`, data.error);
                    continue;
                }

                if (data.success && data.url) {
                    uploaded.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type,
                        size: file.size,
                        isPdf: data.isPdf || false,
                        r2Key: data.r2Key || '',
                    });
                }
            } catch (err) {
                console.error(`Upload error for ${file.name}:`, err);
            }
        }

        if (uploaded.length > 0) {
            onFilesUploaded(uploaded);
        }

        setUploading(false);
        setUploadProgress('');
    }, [folder, disabled, onFilesUploaded]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        uploadFiles(files);
        // Reset input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [uploadFiles]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || uploading) return;

        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, [disabled, uploading]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (disabled || uploading) return;

        const files = Array.from(e.dataTransfer.files);
        if (!multiple && files.length > 1) {
            uploadFiles([files[0]]);
        } else {
            uploadFiles(files);
        }
    }, [disabled, uploading, multiple, uploadFiles]);

    const handleClick = useCallback(() => {
        if (!uploading && !disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, [uploading, disabled]);

    const getFileIcon = (file: UploadedFile) => {
        if (file.type?.startsWith('image/')) {
            return <ImageIcon className="w-4 h-4 text-blue-500" />;
        }
        if (file.type === 'application/pdf' || file.isPdf) {
            return <FileText className="w-4 h-4 text-red-500" />;
        }
        return <FileText className="w-4 h-4 text-amber-500" />;
    };

    const getFilePreview = (file: UploadedFile) => {
        if (file.thumbnailUrl) {
            return (
                <img 
                    src={file.thumbnailUrl} 
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded-lg"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            );
        }
        if (file.type?.startsWith('image/') && file.url) {
            return (
                <img 
                    src={file.url} 
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded-lg"
                />
            );
        }
        return null;
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Drop Zone */}
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
                className={`
                    border-2 border-dashed rounded-2xl 
                    ${compact ? 'p-4' : 'p-6'}
                    flex flex-col items-center justify-center gap-2
                    cursor-pointer
                    transition-all duration-200
                    relative
                    ${dragActive 
                        ? 'border-blue-400 bg-blue-50/50 scale-[1.01] shadow-lg shadow-blue-100' 
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                    }
                    ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}
                `}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple={multiple}
                    accept={accept}
                    disabled={uploading || disabled}
                />

                {uploading ? (
                    <>
                        <Loader2 className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-blue-500 animate-spin`} />
                        <p className="text-xs font-bold text-blue-600">{uploadProgress || 'Uploading...'}</p>
                    </>
                ) : (
                    <>
                        {dragActive ? (
                            <Upload className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-blue-400`} />
                        ) : (
                            <Paperclip className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-slate-300`} />
                        )}
                        <div className="text-center">
                            <p className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-slate-600`}>{label}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{sublabel}</p>
                        </div>
                    </>
                )}
            </div>

            {/* File List */}
            {existingFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                    {existingFiles.map((file, idx) => (
                        <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-slate-200 transition-all"
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {getFilePreview(file) || (
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                                        {getFileIcon(file)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-slate-600 truncate block max-w-[200px]">
                                        {file.name}
                                    </span>
                                    {file.isPdf && (
                                        <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full uppercase">
                                            PDF • R2
                                        </span>
                                    )}
                                    {file.type?.startsWith('image/') && (
                                        <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full uppercase">
                                            Image
                                        </span>
                                    )}
                                </div>
                            </div>
                            {onRemoveFile && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveFile(idx);
                                    }}
                                    className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
