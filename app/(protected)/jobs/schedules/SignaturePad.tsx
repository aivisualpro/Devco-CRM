import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
    onSave: (dataUrl: string) => void;
    employeeName: string;
}

export default function SignaturePad({ onSave, employeeName }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000000';
                ctx.lineCap = 'round';
            }
        }
    }, []);

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

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (canvas && hasSignature) {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Signature for {employeeName}</h4>
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
            <div className="flex justify-between mt-3">
                <button
                    type="button"
                    onClick={clearCanvas}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                >
                    <Eraser size={14} />
                    Clear
                </button>
                <button
                    type="button"
                    onClick={saveSignature}
                    disabled={!hasSignature}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check size={14} />
                    Confirm & Save
                </button>
            </div>
        </div>
    );
}
