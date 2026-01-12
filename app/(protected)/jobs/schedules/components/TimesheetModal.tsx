import { Modal, EmptyState } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

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
                                <p className="text-sm font-bold text-slate-900">SITE TIME</p>
                            </div>
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
        </Modal>
    );
};
