'use client';

import React from 'react';
import { Card, UploadButton } from '@/components/ui';
import { Upload, Image as ImageIcon, Map, Download, ExternalLink, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface EstimateAerialLayoutCardProps {
    formData: any;
    onUpdate: (field: string, value: any) => void;
    schedules: any[];
}

export function EstimateAerialLayoutCard({ formData, onUpdate, schedules }: EstimateAerialLayoutCardProps) {
    const { success, error: toastError } = useToast();

    // Helper: detect if a URL points to a PDF
    const isPdfUrl = (url: string) => {
        if (!url) return false;
        const lower = url.toLowerCase();
        return lower.endsWith('.pdf') || lower.includes('/pdf') || lower.includes('application%2Fpdf');
    };

    // Helper: detect if URL is served through R2 (Worker or proxy)
    const isR2Url = (url: string) => url?.includes('files.devcohq.com') || url?.includes('r2-file-server.devcohq.workers.dev') || url?.startsWith('/api/r2-file');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Aerial Image Column */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                        <ImageIcon className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-blue-700">Aerial Image</h4>
                </div>
                
                <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] min-h-[350px] flex flex-col">
                    <div className="flex-1 flex flex-col gap-3">
                        {formData.aerialImage ? (
                            <>
                                <div className="relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 aspect-video flex items-center justify-center">
                                    {(() => {
                                        const url = formData.aerialImage;
                                        const isPdf = isPdfUrl(url) || isR2Url(url);
                                        const thumbnail = formData.aerialImageThumbnail;
                                        
                                        if (isPdf) {
                                            return (
                                                <div 
                                                    className="w-full h-full relative cursor-pointer group"
                                                    onClick={() => window.open(url, '_blank')}
                                                >
                                                    {/* Show Cloudinary thumbnail if available */}
                                                    {thumbnail ? (
                                                        <img 
                                                            src={thumbnail} 
                                                            alt="Aerial PDF" 
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const fallback = e.currentTarget.parentElement?.querySelector('.pdf-fallback');
                                                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    {/* Fallback PDF placeholder */}
                                                    <div className={`pdf-fallback w-full h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100 ${thumbnail ? 'hidden' : 'flex'}`}>
                                                        <div className="w-16 h-20 rounded-lg bg-red-500 flex items-center justify-center shadow-lg">
                                                            <FileText className="w-8 h-8 text-white" />
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium">Click to view PDF</p>
                                                    </div>
                                                    {/* Hover overlay */}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                                                            <ExternalLink className="w-4 h-4 text-blue-600" />
                                                            <span className="text-xs font-bold text-blue-600">View PDF</span>
                                                        </div>
                                                    </div>
                                                    {/* PDF badge */}
                                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">PDF</div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <img 
                                                src={url} 
                                                alt="Aerial" 
                                                className="w-full h-full object-contain"
                                            />
                                        );
                                    })()}
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                    <UploadButton
                                        showIcon={false}
                                        accept="image/*,application/pdf"
                                        onUpload={(url, data) => {
                                            onUpdate('aerialImage', url);
                                            // Store thumbnail separately for PDFs
                                            if (data?.thumbnailUrl) {
                                                onUpdate('aerialImageThumbnail', data.thumbnailUrl);
                                            } else {
                                                onUpdate('aerialImageThumbnail', '');
                                            }
                                        }}
                                        className="w-full h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                        label={
                                            <div className="flex items-center gap-2">
                                                <Upload className="w-3.5 h-3.5" />
                                                <span>Upload</span>
                                            </div>
                                        }
                                    />
                                    <button 
                                        onClick={() => {
                                            const u = formData.aerialImage;
                                            // For R2/Worker files, add download param; for others open directly
                                            const separator = u.includes('?') ? '&' : '?';
                                            const downloadUrl = isR2Url(u)
                                                ? `${u}${separator}download=true`
                                                : u;
                                            window.open(downloadUrl, '_blank');
                                        }}
                                        className="w-full h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                        title="Download"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            onUpdate('aerialImage', '');
                                            onUpdate('aerialImageThumbnail', '');
                                        }}
                                        className="w-full h-10 bg-white border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Remove</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors bg-slate-50/50">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <h5 className="text-sm font-semibold text-slate-600 mb-1">Upload Aerial Image</h5>
                                <p className="text-xs text-slate-400 mb-4 text-center max-w-[200px]">
                                    Upload a satellite image, map view, or PDF of the site
                                </p>
                                <UploadButton
                                    accept="image/*,application/pdf"
                                    onUpload={(url, data) => {
                                        onUpdate('aerialImage', url);
                                        if (data?.thumbnailUrl) {
                                            onUpdate('aerialImageThumbnail', data.thumbnailUrl);
                                        }
                                    }}
                                    className="px-4 py-2 bg-[#0F4C75] text-white rounded-lg text-xs font-bold hover:bg-[#0F4C75]/90 transition-all shadow-sm"
                                    label="Select Image or PDF"
                                />
                                <div className="flex items-center gap-2 w-full max-w-[240px] mt-4 mb-2">
                                    <div className="h-px bg-slate-200 flex-1" />
                                    <span className="text-[10px] text-slate-400 font-medium">OR</span>
                                    <div className="h-px bg-slate-200 flex-1" />
                                </div>
                                <div className="w-full max-w-[240px]">
                                    <input 
                                        type="text"
                                        placeholder="Paste Image or PDF URL"
                                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-300 bg-white"
                                        onBlur={(e) => {
                                            if (e.target.value) onUpdate('aerialImage', e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onUpdate('aerialImage', e.currentTarget.value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Site Layout Column */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md">
                        <Map className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-emerald-700">Site Layout</h4>
                </div>

                <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] min-h-[350px] flex flex-col">
                     <div className="flex-1 flex flex-col gap-3">
                        {formData.siteLayout ? (
                            <>
                                <div className="relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 aspect-video flex items-center justify-center">
                                {(() => {
                                    // Helper to determine display content
                                    const url = formData.siteLayout;
                                    const isUrl = url.startsWith('http');
                                    
                                    // specific check for google earth/maps
                                    if (isUrl && (url.includes('earth.google.com') || url.includes('maps.google.com') || url.includes('google.com/maps'))) {
                                        // Try to extract coordinates
                                        const coords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                        if (coords) {
                                            const [_, lat, lng] = coords;
                                            // Construct embeddable map URL (Satellite view)
                                            const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
                                            return (
                                                <iframe 
                                                    src={embedUrl} 
                                                    className="w-full h-full border-0"
                                                    allowFullScreen
                                                    loading="lazy"
                                                    allow="geolocation"
                                                />
                                            );
                                        }
                                        
                                        // Fallback if no coordinates found but is google link
                                        return (
                                           <div className="flex flex-col items-center gap-2 p-4 text-center">
                                                <Map className="w-8 h-8 text-slate-300" />
                                                <p className="text-xs text-slate-500">Preview not available for this link</p>
                                                <a 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    Open in Google Earth <Upload className="w-3 h-3" />
                                                </a>
                                           </div>
                                        );
                                    }

                                    // Default image render
                                    return (
                                        <img 
                                            src={url} 
                                            alt="Site Layout" 
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                // Fallback on image error (e.g. if it was a non-image URL)
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('flex-col');
                                            }}
                                        />
                                    );
                                })()}
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <input 
                                        type="text"
                                        defaultValue={formData.siteLayout}
                                        placeholder="Paste Google Earth Link..."
                                        className="flex-1 h-10 text-xs border border-slate-200 rounded-lg px-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-300"
                                        onBlur={(e) => {
                                             if (e.target.value !== formData.siteLayout) onUpdate('siteLayout', e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onUpdate('siteLayout', e.currentTarget.value);
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => window.open(formData.siteLayout, '_blank')}
                                        className="h-10 px-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-colors border border-emerald-100 flex items-center justify-center font-bold text-xs gap-2"
                                        title="Open Link"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                             <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors bg-slate-50/50">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                    <Map className="w-5 h-5" />
                                </div>
                                <h5 className="text-sm font-semibold text-slate-600 mb-1">Add Site Layout URL</h5>
                                <p className="text-xs text-slate-400 mb-4 text-center max-w-[200px]">
                                    Paste a Google Earth or Maps link
                                </p>
                                
                                <div className="w-full max-w-[240px]">
                                    <input 
                                        type="text"
                                        placeholder="Paste Google Earth Link..."
                                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-300 bg-white"
                                        onBlur={(e) => {
                                            if (e.target.value) onUpdate('siteLayout', e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onUpdate('siteLayout', e.currentTarget.value);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
