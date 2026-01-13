import React from 'react';
import { Modal } from '@/components/ui';
import { Navigation, MapPin, Clock, Route } from 'lucide-react';

interface DriveMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    startLocation?: string; // "lat,lng"
    endLocation?: string;   // "lat,lng"
    distance?: number;
    duration?: string; // Optional: drive time duration
}

export const DriveMapModal = ({ isOpen, onClose, startLocation, endLocation, distance, duration }: DriveMapModalProps) => {
    if (!isOpen) return null;

    // Use Google Maps Embed API with directions mode to show route path
    // This requires a Google Maps API key - fallback to regular embed if not available
    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // Directions embed URL that shows the route path
    // Format: https://www.google.com/maps/embed/v1/directions?key=API_KEY&origin=lat,lng&destination=lat,lng&mode=driving
    const directionsEmbedUrl = GOOGLE_MAPS_API_KEY 
        ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${startLocation}&destination=${endLocation}&mode=driving`
        : null;
    
    // Fallback to legacy embed (doesn't show route line as well)
    const legacyEmbedUrl = `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d50000!2d${startLocation?.split(',')[1]}!3d${startLocation?.split(',')[0]}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s${startLocation}!2s!3m2!1d${startLocation?.split(',')[0]}!2d${startLocation?.split(',')[1]}!4m5!1s${endLocation}!2s!3m2!1d${endLocation?.split(',')[0]}!2d${endLocation?.split(',')[1]}!5e1!3m2!1sen!2sus!4v1`;
    
    // Alternative: Use a direct directions link that works without API key
    const alternativeEmbedUrl = `https://www.google.com/maps/dir/${startLocation}/${endLocation}/@${startLocation},10z/data=!3m1!4b1!4m2!4m1!3e0?entry=ttu`;
    
    // Best option: Use directions embed that shows the route path
    // This format works better for showing the actual driving route
    const mapSrc = directionsEmbedUrl 
        || `https://www.google.com/maps?saddr=${startLocation}&daddr=${endLocation}&dirflg=d&output=embed`;
    
    const openInNewTab = `https://www.google.com/maps/dir/?api=1&origin=${startLocation}&destination=${endLocation}&travelmode=driving`;

    // Parse coordinates for display
    const startCoords = startLocation?.split(',');
    const endCoords = endLocation?.split(',');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Drive Time Route"
            maxWidth="5xl"
        >
            <div className="space-y-4 pt-2">
                {/* Route Info Header */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        {/* Start Location */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <Navigation className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Point</div>
                                <div className="font-mono text-sm text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                                    {startCoords ? `${parseFloat(startCoords[0]).toFixed(6)}, ${parseFloat(startCoords[1]).toFixed(6)}` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Distance & Duration */}
                        <div className="flex items-center gap-4">
                            {distance !== undefined && distance > 0 && (
                                <div className="flex items-center gap-2 bg-[#0F4C75] text-white px-4 py-2 rounded-full shadow-md">
                                    <Route className="w-4 h-4" />
                                    <span className="font-bold text-lg">{distance.toFixed(1)} miles</span>
                                </div>
                            )}
                            {duration && (
                                <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-md">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-bold">{duration}</span>
                                </div>
                            )}
                        </div>

                        {/* End Location */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Point</div>
                                <div className="font-mono text-sm text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                                    {endCoords ? `${parseFloat(endCoords[0]).toFixed(6)}, ${parseFloat(endCoords[1]).toFixed(6)}` : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Map Container */}
                <div className="h-[500px] w-full bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 shadow-lg">
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        src={mapSrc}
                        allowFullScreen
                        className="absolute inset-0"
                        title="Drive Route Map"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                </div>
                
                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-slate-400">
                        Route calculated via Google Maps
                    </div>
                    <a 
                        href={openInNewTab} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-6 py-2.5 bg-gradient-to-r from-[#1A1A1A] to-[#333] text-white text-sm font-bold rounded-xl hover:from-black hover:to-[#1A1A1A] transition-all shadow-lg flex items-center gap-2"
                    >
                        <span>Open in Google Maps</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
        </Modal>
    );
};
