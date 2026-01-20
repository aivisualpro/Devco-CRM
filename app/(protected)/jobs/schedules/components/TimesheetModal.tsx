import { Modal, EmptyState } from '@/components/ui';
import { CheckCircle2, MapPin } from 'lucide-react';
import { useState, useMemo } from 'react';
import { DriveMapModal } from './DriveMapModal';

interface TimesheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTimesheet: any;
    setSelectedTimesheet: (ts: any) => void;
    isEditMode: boolean;
    setIsEditMode: (edit: boolean) => void;
    handleSave: (e: React.FormEvent) => void;
}

export const TimesheetModal = ({
    isOpen,
    onClose,
    selectedTimesheet,
    setSelectedTimesheet,
    isEditMode,
    setIsEditMode,
    handleSave
}: TimesheetModalProps) => {

    const formatToReadableDateTime = (dateInput: string | Date) => {
        if (!dateInput) return 'N/A';
        return new Date(dateInput).toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const [mapModalOpen, setMapModalOpen] = useState(false);

    const distanceInfo = useMemo(() => {
        if (!selectedTimesheet) return null;
        const type = String(selectedTimesheet.type || '').toUpperCase();
        if (!type.includes('DRIVE')) return null;

        const locIn = selectedTimesheet.locationIn;
        const locOut = selectedTimesheet.locationOut;
        
        // Prioritize persisted distance
        let dist = typeof selectedTimesheet.distance === 'number' ? selectedTimesheet.distance : parseFloat(selectedTimesheet.distance);
        if (!isNaN(dist) && dist > 0) {
            const isCoords = typeof locIn === 'string' && locIn.includes(',') && typeof locOut === 'string' && locOut.includes(',');
            return { distance: dist, isCoords, start: locIn, end: locOut };
        }

        let isCoords = false;
        const isCoordStr = (val: any) => typeof val === 'string' && val.includes(',') && !isNaN(Number(val.split(',')[0]));

        if (isCoordStr(locIn) && isCoordStr(locOut)) {
            isCoords = true;
             // Haversine
             const [lat1, lon1] = locIn.split(',').map(Number);
             const [lat2, lon2] = locOut.split(',').map(Number);
             
             const R = 3958.8; 
             const dLat = (lat2 - lat1) * (Math.PI / 180);
             const dLon = (lon2 - lon1) * (Math.PI / 180);
             const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                       Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                       Math.sin(dLon/2) * Math.sin(dLon / 2);
             const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
             dist = R * c * 1.364; // Approximate Road Miles
        } else {
             // Odometer fallback
             const parse = (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0;
             const lIn = parse(locIn);
             const lOut = parse(locOut);
             if (lOut > lIn) dist = lOut - lIn;
        }

        return { distance: dist || 0, isCoords, start: locIn, end: locOut };

    }, [selectedTimesheet]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? "Register SITE TIME" : "My Timesheet Record"}
            maxWidth="md"
        >
            {selectedTimesheet ? (
                isEditMode ? (
                    <form onSubmit={handleSave} className="py-2">
                        <div className="space-y-6">
                            {/* Lunch Times Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-900">Lunch Start</label>
                                    <input 
                                        type="time"
                                        className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                        value={selectedTimesheet.lunchStartTime || ''}
                                        onChange={(e) => setSelectedTimesheet({...selectedTimesheet, lunchStartTime: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-900">Lunch End</label>
                                    <input 
                                        type="time"
                                        className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                        value={selectedTimesheet.lunchEndTime || ''}
                                        onChange={(e) => setSelectedTimesheet({...selectedTimesheet, lunchEndTime: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">Comments</label>
                                <textarea 
                                    className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all min-h-[100px] resize-none placeholder:text-slate-400"
                                    value={selectedTimesheet.comments || ''}
                                    placeholder="Add notes about your work today..."
                                    onChange={(e) => setSelectedTimesheet({...selectedTimesheet, comments: e.target.value})}
                                />
                                <p className="text-xs text-slate-400 text-right">0/100 characters</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all flex items-center gap-2 font-sans shadow-sm"
                                >
                                    Save Record
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 pt-2">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Clocked In</label>
                                <p className="text-sm font-bold text-slate-900">{formatToReadableDateTime(selectedTimesheet.clockIn)}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Clocked Out</label>
                                <p className="text-sm font-bold text-slate-900">{formatToReadableDateTime(selectedTimesheet.clockOut)}</p>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Lunch Break</label>
                                <p className="text-sm font-bold text-slate-900">
                                    {selectedTimesheet.lunchStart ? new Date(selectedTimesheet.lunchStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'} 
                                    {' - '} 
                                    {selectedTimesheet.lunchEnd ? new Date(selectedTimesheet.lunchEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Work Type</label>
                                <p className="text-sm font-bold text-slate-900">{selectedTimesheet.type || 'SITE TIME'}</p>
                            </div>
                            {distanceInfo && (
                                 <div className="space-y-1 col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Distance Traveled</label>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-slate-900">{distanceInfo.distance.toFixed(1)} miles</p>
                                        {distanceInfo.isCoords && (
                                            <button 
                                                onClick={() => setMapModalOpen(true)}
                                                className="text-xs flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-bold"
                                            >
                                                <MapPin size={12} />
                                                View Map
                                            </button>
                                        )}
                                    </div>
                                 </div>
                            )}
                        </div>
                        
                        {selectedTimesheet.comments && (
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Comments</label>
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700">
                                    {selectedTimesheet.comments}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                            >
                                Edit
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-sm font-sans"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )
            ) : (
                <EmptyState title="No Record" message="No timesheet data found for your user." />
            )}
        <DriveMapModal 
                isOpen={mapModalOpen} 
                onClose={() => setMapModalOpen(false)}
                startLocation={distanceInfo?.start}
                endLocation={distanceInfo?.end}
                distance={distanceInfo?.distance}
            />
        </Modal>
    );
};
