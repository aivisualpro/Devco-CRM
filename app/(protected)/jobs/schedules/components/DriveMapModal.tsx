import React from 'react';
import { Modal } from '@/components/ui';

interface DriveMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    startLocation?: string; // "lat,lng"
    endLocation?: string;   // "lat,lng"
    distance?: number;
}

export const DriveMapModal = ({ isOpen, onClose, startLocation, endLocation, distance }: DriveMapModalProps) => {
    if (!isOpen) return null;

    // Consturct embed URL
    // saddr = start address, daddr = destination address
    const mapSrc = `https://maps.google.com/maps?saddr=${startLocation}&daddr=${endLocation}&output=embed&z=12&t=h`;
    const openInNewTab = `https://www.google.com/maps/dir/?api=1&origin=${startLocation}&destination=${endLocation}`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Drive Time Route"
            maxWidth="4xl"
        >
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-500">Start:</span>
                         <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{startLocation || 'N/A'}</span>
                    </div>
                    {distance !== undefined && (
                        <div className="font-bold text-[#0F4C75] bg-blue-50 px-3 py-1 rounded-full">
                            {distance.toFixed(1)} miles
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-500">End:</span>
                         <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{endLocation || 'N/A'}</span>
                    </div>
                </div>

                <div className="h-[500px] w-full bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 shadow-inner">
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={mapSrc}
                        allowFullScreen
                        className="absolute inset-0"
                        title="Drive Route Map"
                    ></iframe>
                </div>
                
                <div className="flex justify-end pt-2">
                    <a 
                        href={openInNewTab} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-sm flex items-center gap-2"
                    >
                        <span>Open in Google Maps</span>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
        </Modal>
    );
};
