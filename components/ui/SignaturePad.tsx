'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check, PenTool, Trash2 } from 'lucide-react';

interface SignaturePadProps {
    value?: string;
    onChange: (signature: string) => void;
    className?: string;
    label?: string; // e.g., "Signature for Adeel"
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ value, onChange, className, label = 'Signature' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    
    // Mode: 'view' (showing existing image) or 'edit' (drawing new one)
    const [isEditing, setIsEditing] = useState(!value);

    useEffect(() => {
        // Initialize canvas when entering edit mode
        if (isEditing) {
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
    }, [isEditing]);

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

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas && hasSignature) {
            const dataUrl = canvas.toDataURL('image/png');
            onChange(dataUrl);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setHasSignature(false);
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

    // Edit Mode: Drawing Canvas (Matches JHA style)
    return (
        <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm w-full max-w-md ${className || ''}`}>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{label}</h4>
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
            <div className="flex justify-between gap-3 mt-3">
                <button
                    type="button"
                    onClick={value ? handleCancel : clearCanvas}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-500 bg-slate-100 rounded-lg transition-colors"
                >
                    <Eraser size={14} />
                    {value ? 'Cancel' : 'Clear'}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasSignature}
                    className="flex-[2] flex items-center justify-center gap-1 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check size={14} />
                    Confirm & Save
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
