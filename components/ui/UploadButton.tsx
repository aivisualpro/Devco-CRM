'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface UploadButtonProps {
    onUpload: (url: string) => void;
    folder?: string;
    className?: string;
    label?: string;
    disabled?: boolean;
}

export function UploadButton({
    onUpload,
    folder = 'uploads',
    className = '',
    label,
    disabled
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
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
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
                onUpload(data.url);
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
        <div className={className}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*" // Default to images given context, or could be passed as prop
                disabled={uploading || disabled}
            />
            <button
                type="button"
                onClick={handleClick}
                disabled={uploading || disabled}
                className={`p-2 bg-[#0F4C75] text-white rounded-lg hover:bg-[#0a3a5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}
                title="Upload Image"
            >
                {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Upload className="w-4 h-4" />
                )}
                {label && <span className="text-sm font-medium">{label}</span>}
            </button>
        </div>
    );
}
