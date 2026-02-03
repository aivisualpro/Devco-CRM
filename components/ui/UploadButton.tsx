'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface UploadButtonProps {
    onUpload: (url: string, data?: any) => void;
    folder?: string;
    className?: string;
    label?: React.ReactNode;
    showIcon?: boolean;
    disabled?: boolean;
    multiple?: boolean;
}

export function UploadButton({
    onUpload,
    folder = 'uploads',
    className = '',
    label,
    showIcon = true,
    disabled,
    multiple = false
}: UploadButtonProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { error: toastError } = useToast();

    const handleClick = () => {
        if (!uploading && !disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setUploading(true);
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', folder);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                if (data.success && data.url) {
                    onUpload(data.url, data);
                }
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            toastError(err.message || 'Failed to upload file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className={className.includes('w-full') ? 'w-full' : ''}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple={multiple}
                disabled={uploading || disabled}
            />
            <button
                type="button"
                onClick={handleClick}
                disabled={uploading || disabled}
                className={`transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center ${
                    className.includes('p-') ? '' : 'p-2'
                } ${
                    className.includes('bg-') ? '' : 'bg-[#0F4C75]'
                } ${
                    className.includes('text-') ? '' : 'text-white'
                } ${
                    className.includes('rounded') ? '' : 'rounded-lg'
                } ${
                    className.includes('hover:bg-') ? '' : 'hover:bg-[#0a3a5c]'
                } ${className}`}
                title="Upload Image"
            >
                {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    showIcon && <Upload className="w-4 h-4" />
                )}
                {label && (typeof label === 'string' ? <span className="text-sm font-medium">{label}</span> : label)}
            </button>
        </div>
    );
}
