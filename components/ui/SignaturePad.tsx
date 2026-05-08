'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check, PenTool, Trash2, Upload, Pen } from 'lucide-react';

interface SignaturePadProps {
    value?: string;
    onChange: (signature: string) => Promise<void> | void;
    className?: string;
    label?: string; // e.g., "Signature for Adeel"
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ value, onChange, className, label = 'Signature' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Mode: 'view' (showing existing image) or 'edit' (drawing/uploading new one)
    const [isEditing, setIsEditing] = useState(!value);
    // Tab: 'draw' or 'upload'
    const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
    // Uploaded image preview
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    useEffect(() => {
        // Initialize canvas when entering edit mode with draw tab
        if (isEditing && activeTab === 'draw') {
            const canvas = canvasRef.current;
            if (canvas) {
                // Set resolution matching display size
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#000000';
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                }
            }
        }
    }, [isEditing, activeTab]);

    const getTouchPos = (canvasDom: HTMLCanvasElement, touchEvent: React.TouchEvent) => {
        const rect = canvasDom.getBoundingClientRect();
        return {
            x: touchEvent.touches[0].clientX - rect.left,
            y: touchEvent.touches[0].clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        
        let x, y;
        if ('touches' in e) {
            const pos = getTouchPos(canvas, e);
            x = pos.x;
            y = pos.y;
        } else {
            const mouseE = e as React.MouseEvent;
            x = mouseE.nativeEvent.offsetX;
            y = mouseE.nativeEvent.offsetY;
        }
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let x, y;
        if ('touches' in e) {
            const pos = getTouchPos(canvas, e);
            x = pos.x;
            y = pos.y;
        } else {
            const mouseE = e as React.MouseEvent;
            x = mouseE.nativeEvent.offsetX;
            y = mouseE.nativeEvent.offsetY;
        }
        
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                setHasSignature(false);
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setUploadedImage(dataUrl);
            setHasSignature(true);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (activeTab === 'upload' && uploadedImage) {
                await onChange(uploadedImage);
                setIsEditing(false);
                setUploadedImage(null);
            } else if (activeTab === 'draw') {
                const canvas = canvasRef.current;
                if (canvas && hasSignature) {
                    const dataUrl = canvas.toDataURL('image/png');
                    await onChange(dataUrl);
                    setIsEditing(false);
                }
            }
        } catch (err) {
            console.error("Error saving signature", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setHasSignature(false);
        setUploadedImage(null);
        setActiveTab('draw');
    };

    const handleTabSwitch = (tab: 'draw' | 'upload') => {
        setActiveTab(tab);
        setHasSignature(false);
        setUploadedImage(null);
        if (tab === 'draw') {
            // Clear canvas on next tick after render
            setTimeout(() => clearCanvas(), 50);
        }
    };

    // View Mode: Show existing signature
    if (!isEditing && value) {
        return (
            <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm w-full max-w-md ${className || ''}`}>
                <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-indigo-500" />
                    {label}
                </h4>
                <div className="relative w-full h-40 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-2 mb-3">
                    <img 
                        src={value} 
                        alt="Signature" 
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setIsEditing(true);
                        setActiveTab('draw');
                        // We reset signature on edit start so user draws a new one
                        // If you wanted to edit existing, you'd need to drawImage onto canvas
                        // but usually signatures are re-drawn.
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    <Eraser size={16} />
                    Redraw Signature
                </button>
            </div>
        );
    }

    // Edit Mode: Draw or Upload
    return (
        <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm w-full max-w-md ${className || ''}`}>
            <h4 className="text-sm font-bold text-slate-700 mb-3">{label}</h4>

            {/* Draw / Upload Tabs */}
            <div className="flex p-0.5 bg-slate-100 rounded-lg mb-3">
                <button
                    type="button"
                    onClick={() => handleTabSwitch('draw')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'draw'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Pen size={13} />
                    Draw
                </button>
                <button
                    type="button"
                    onClick={() => handleTabSwitch('upload')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'upload'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Upload size={13} />
                    Upload
                </button>
            </div>

            {/* Draw Tab */}
            {activeTab === 'draw' && (
                <div className="relative w-full h-40 bg-slate-50 border border-slate-300 rounded-lg overflow-hidden touch-none">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
            )}

            {/* Upload Tab */}
            {activeTab === 'upload' && (
                <div className="relative w-full h-40 border border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                    {uploadedImage ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                            <img
                                src={uploadedImage}
                                alt="Uploaded signature"
                                className="max-w-full max-h-full object-contain"
                            />
                            <button
                                type="button"
                                onClick={() => { setUploadedImage(null); setHasSignature(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="absolute top-2 right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Upload size={20} className="text-slate-400" />
                            </div>
                            <span className="text-xs font-bold">Click to upload signature image</span>
                            <span className="text-[10px] text-slate-300">PNG, JPG up to 5MB</span>
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 mt-3">
                <button
                    type="button"
                    onClick={value ? handleCancel : (activeTab === 'draw' ? clearCanvas : () => { setUploadedImage(null); setHasSignature(false); })}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-500 bg-slate-100 rounded-lg transition-colors"
                >
                    <Eraser size={14} />
                    {value ? 'Cancel' : 'Clear'}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasSignature || isSaving}
                    className="flex-[2] flex items-center justify-center gap-1 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Check size={14} />
                    )}
                    {isSaving ? 'Saving...' : 'Confirm & Save'}
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
