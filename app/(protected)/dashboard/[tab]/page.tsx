'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
    Package, FileText, Calculator, TrendingUp, Activity,
    CheckCircle, Users, Layers, Zap, ArrowRight, ArrowUpRight,
    Clock, MoreHorizontal, Briefcase, FileSpreadsheet,
    Calendar, DollarSign, ClipboardCheck, AlertTriangle,
    Settings, BarChart3, FileCheck, Shield, ShieldCheck, Plus, Sparkles,
    ChevronRight, ChevronLeft, Truck, Tag, MapPin, X, Edit, Trash2, Phone, FilePlus, ClipboardList, CheckCircle2, AlertCircle, Timer, ClockCheck, Download, Loader2, Mail, Car, StopCircle, Circle, Droplets, Warehouse
} from 'lucide-react';
import { Header, Modal, Badge, EmptyState, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { Geolocation } from '@capacitor/geolocation';
import { Tabs, TabsList, TabsTrigger, TabsContent, BadgeTabs } from '@/components/ui/Tabs';
import SignaturePad from '../../jobs/schedules/SignaturePad';
import { DJTModal } from '../../jobs/schedules/components/DJTModal';
import { TimesheetModal } from '../../jobs/schedules/components/TimesheetModal';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';

interface Stats {
    catalogueItems: number;
    laborItems: number;
    materialItems: number;
    equipmentItems: number;
    estimates: number;
    activeEstimates: number;
    completedEstimates: number;
    totalValue: number;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    var EARTH_RADIUS_MI = 3958.8; // Radius of the earth in miles
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_MI * c;
}

export default function DashboardPage() {
    const router = useRouter();
    const params = useParams();
    const { success, error: toastError } = useToast();
    const { user } = usePermissions();
    const [stats, setStats] = useState<Stats>({
        catalogueItems: 0,
        laborItems: 0,
        materialItems: 0,
        equipmentItems: 0,
        estimates: 0,
        activeEstimates: 0,
        completedEstimates: 0,
        totalValue: 0
    });
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    
    // Sync tab with URL
    const dashboardTab = (params?.tab as string) || 'jobschedule';
    
    useEffect(() => {
        if (params && params.tab && !['activity', 'jobschedule'].includes(params.tab as string)) {
            router.replace('/dashboard/jobschedule');
        }
    }, [params, router]);

    const setDashboardTab = (tab: 'activity' | 'jobschedule') => {
        router.push(`/dashboard/${tab}`);
    };

    // JHA State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // DJT State
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Timesheet State
    const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);
    const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
    const [isTimesheetEditMode, setIsTimesheetEditMode] = useState(false);

    // Schedule Logic
    const [scheduleDate, setScheduleDate] = useState<Date>(() => {
        // Use a stable date for initial render to avoid hydration mismatch
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [dailySchedules, setDailySchedules] = useState<any[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
    const [constants, setConstants] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [estimates, setEstimates] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    // Media Modal State
    const [mediaModal, setMediaModal] = useState<{ isOpen: boolean; type: 'image' | 'map'; url: string; title: string }>({
        isOpen: false,
        type: 'image',
        url: '',
        title: ''
    });

    // Current User
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = localStorage.getItem('devco_user');
            if (user) {
                try {
                    setCurrentUser(JSON.parse(user));
                } catch (e) {
                    console.error('Failed to parse user', e);
                }
            }

            if (window.innerWidth < 768 && dashboardTab !== 'jobschedule') {
                setDashboardTab('jobschedule');
            }
        }
    }, [dashboardTab]);

    // Filter schedules based on current user
    const filteredDailySchedules = useMemo(() => {
        return dailySchedules.filter(item => {
            if (!currentUser?.email) return true;
            return item.projectManager === currentUser.email || 
                   item.foremanName === currentUser.email || 
                   (item.assignees || []).includes(currentUser.email);
        });
    }, [dailySchedules, currentUser]);

    // Check for any active drive time across ALL schedules for the current user
    // Active = clockOut is not set (undefined/null/empty) - meaning still in progress
    const globalActiveDriveTime = useMemo(() => {
        if (!currentUser?.email) return null;
        for (const schedule of dailySchedules) {
            const activeTs = (schedule.timesheet || []).find((ts: any) => {
                if (ts.employee !== currentUser.email) return false;
                if (ts.type !== 'Drive Time') return false;
                
                // Check if clockOut is NOT set (active drive time)
                // clockOut must be undefined, null, or empty string to be considered active
                const clockOutValue = ts.clockOut;
                const isActive = clockOutValue === undefined || 
                                 clockOutValue === null || 
                                 clockOutValue === '' ||
                                 (typeof clockOutValue === 'string' && clockOutValue.trim() === '');
                
                return isActive;
            });
            if (activeTs) {
                return { ...activeTs, scheduleTitle: schedule.title, scheduleId: schedule._id };
            }
        }
        return null;
    }, [dailySchedules, currentUser]);

    const formatLocalDate = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatLocalDateTime = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const extractTimeFromDateTime = (dateInput: string | Date) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const combineCurrentDateWithTime = (timeStr: string) => {
        if (!timeStr) return '';
        const now = new Date();
        const [hours, minutes] = timeStr.split(':');
        now.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return now.toISOString();
    };
    const handleDownloadJhaPdf = async () => {
        if (!selectedJHA) return;
        setIsGeneratingJHAPDF(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            
            // Build variables from selectedJHA and its parent schedule
            const schedule = dailySchedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
            
            // Find matching estimate for contact info
            // Find matching estimate by estimate number (string match) - EXCLUDE ID MATCHING
            const est = estimates.find(e => {
                const estNum = e.estimate || e.estimateNum;
                // Strict check against schedule's estimate field
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });
            
            // Find matching client for customer name
            const client = clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName || c.value === schedule?.customerId);
            
            // Combine fields
            const variables: Record<string, any> = {
                ...selectedJHA,
                // Customer name from clients collection
                customerId: client?.name || schedule?.customerName || '',
                // Contact info from estimate
                contactName: est?.contactName || est?.contact || client?.name || '',
                contactPhone: est?.contactPhone || est?.phone || client?.phone || '',
                jobAddress: est?.jobAddress || est?.address || schedule?.jobLocation || '',
                // Other schedule info
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || '',
                estimate: est?.estimate || schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                addressOfHospital: selectedJHA.addressOfHospital || selectedJHA.hospitalAddress || '', 
                date: selectedJHA.date ? new Date(selectedJHA.date).toLocaleDateString() : '',
            };

            // Convert booleans to "✔️" for checkboxes in the template
            const booleanFields = [
                 'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                 'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            // Prepare multiple signatures (Clear slots up to 15)
            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName; 
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate JHA PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `JHA_${schedule?.customerName || 'Report'}_${selectedJHA.usaNo || 'Doc'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            success('JHA PDF downloaded successfully!');
        } catch (err) {
            console.error('Download PDF error:', err);
            toastError("Failed to generate PDF");
        } finally {
            setIsGeneratingJHAPDF(false);
        }
    };

    const handleToggleObjective = async (scheduleId: string, index: number, currentStatus: boolean) => {
        // Find existing schedule
        const schedule = dailySchedules.find(s => s._id === scheduleId);
        if (!schedule) return;

        // Clone deeply to avoid mutation issues
        const updatedObjectives = schedule.todayObjectives ? [...schedule.todayObjectives] : [];
        if (!updatedObjectives[index]) return; 

        // Update object
        const updatedObj = typeof updatedObjectives[index] === 'string' 
            ? { text: updatedObjectives[index] as string, completed: !currentStatus }
            : { ...updatedObjectives[index], completed: !currentStatus };

        // Add metadata if completing
        if (!currentStatus) { // If marking as complete
            updatedObj.completedBy = user?.email || 'Unknown';
            updatedObj.completedAt = new Date().toISOString();
        } else {
            updatedObj.completedBy = undefined;
            updatedObj.completedAt = undefined;
        }

        updatedObjectives[index] = updatedObj;

        // Optimistic update locally
        setDailySchedules(prev => prev.map(s => s._id === scheduleId ? { ...s, todayObjectives: updatedObjectives } : s));
        if (selectedSchedule?._id === scheduleId) {
            setSelectedSchedule((prev: any) => prev ? { ...prev, todayObjectives: updatedObjectives } : null);
        }

        // Send to API
        try {
            const payload = {
                action: 'updateSchedule',
                payload: {
                    ...schedule,
                    todayObjectives: updatedObjectives
                }
            };
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                success('Objective updated');
            } else {
                 throw new Error(data.error || 'Failed to update');
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to update objective");
        }
    };

    const handleEmailJhaPdf = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA || !emailTo) return;
        
        setIsSendingEmail(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            
            // Build variables (Duplicate logic from download for safety)
            const schedule = dailySchedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
            // Find matching estimate by estimate number (string match) - EXCLUDE ID MATCHING
            const est = estimates.find(e => {
                const estNum = e.estimate || e.estimateNum;
                // Strict check against schedule's estimate field
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });
            const client = clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName || c.value === schedule?.customerId);
            
            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: est?.contactName || est?.contact || client?.name || '',
                contactPhone: est?.contactPhone || est?.phone || client?.phone || '',
                jobAddress: est?.jobAddress || est?.address || schedule?.jobLocation || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || '',
                estimate: est?.estimate || schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                addressOfHospital: selectedJHA.addressOfHospital || selectedJHA.hospitalAddress || '', 
                date: selectedJHA.date ? new Date(selectedJHA.date).toLocaleDateString() : '',
            };

            const booleanFields = [
                 'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                 'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName; 
                });
            } else {
                variables.hasSignatures = false;
            }

            // 1. Generate PDF
            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();

            // 2. Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string; 
                
                // 3. Send Email
                const emailRes = await fetch('/api/email-jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: 'JHA Document',
                        emailBody: 'Please find attached JHA document',
                        attachment: base64data,
                        jhaId: selectedJHA._id,
                        scheduleId: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    success('PDF emailed successfully!');
                    setEmailModalOpen(false);
                    setEmailTo('');
                    // Update Local State
                    setSelectedJHA((prev: any) => ({
                         ...prev, 
                         emailCounter: (prev.emailCounter || 0) + 1,
                         jhaEmails: emailData.jha?.jhaEmails || [...(prev.jhaEmails || []), { emailto: emailTo, createdAt: new Date() }]
                    }));
                } else {
                    throw new Error(emailData.error || 'Failed to send email');
                }
                setIsSendingEmail(false);
            };
        } catch (error: any) {
            console.error('Email Error:', error);
            toastError(error.message || 'Failed to email PDF');
            setIsSendingEmail(false);
        }
    };

    const formatToReadableDateTime = (dateInput: string | Date | undefined) => {
        if (!dateInput) return '--/--/---- --:--';
        return new Date(dateInput).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Helper functions for distance calculation
    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    const getDistanceFromLatLonInMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const EARTH_RADIUS_MI = 6371; // Using spreadsheet constant
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_MI * c; // Matches spreadsheet logic
    };



    // Drive Time Logic
    const handleDriveTimeToggle = async (schedule: any, activeDriveTime: any, e: React.MouseEvent) => {
       e.stopPropagation();
       
       let employeeEmail = currentUser?.email;
       // Fallback if currentUser is missing context
       if (!employeeEmail && typeof window !== 'undefined') {
            try {
                employeeEmail = JSON.parse(localStorage.getItem('devco_user') || '{}')?.email;
            } catch (e) { console.error(e); }
       }

       if (!employeeEmail) {
           toastError("User identity not found.");
           return;
       }

       // Geolocation
       const getPosition = async (): Promise<{coords: {latitude: number, longitude: number}}> => {
           const perm = await Geolocation.checkPermissions();
           if (perm.location !== 'granted') {
               const req = await Geolocation.requestPermissions();
               if (req.location !== 'granted') {
                   throw { code: 1, message: 'Permission denied' };
               }
           }
           
           try {
               // High accuracy attempt
               return await Geolocation.getCurrentPosition({
                   enableHighAccuracy: true,
                   timeout: 10000
               });
           } catch (e) {
               // Fallback to low accuracy
               return await Geolocation.getCurrentPosition({
                   enableHighAccuracy: false,
                   timeout: 5000
               });
           }
       };

        try {
             let latitude = 0;
             let longitude = 0;
             let positionFound = false;

             try {
                 const position = await getPosition();
                 latitude = position.coords.latitude;
                 longitude = position.coords.longitude;
                 positionFound = true;
             } catch (locErr: any) {
                 console.warn("Location retrieval failed:", locErr);
                 const errorMsg = locErr?.code === 1 
                     ? "GPS Permission Denied. Please enable Location Services in your app settings to record Drive Time."
                     : "GPS location timed out. Location is required for Drive Time to calculate distance and hours.";
                 toastError(errorMsg);
                 return; // Block for Drive Time
             }

             if (activeDriveTime) {
                 // STOP DRIVE TIME
                 let distance = 0;
                 if (activeDriveTime.locationIn && positionFound) {
                     const [startLat, startLng] = activeDriveTime.locationIn.split(',').map(Number);
                     if (!isNaN(startLat) && !isNaN(startLng)) {
                         // Driving Distance (Haversine * 1.19)
                         distance = getDistanceFromLatLonInMiles(startLat, startLng, latitude, longitude) * 1.19;
                     }
                 }

                 const isDumpWashout = activeDriveTime.dumpWashout === 'TRUE' || activeDriveTime.type?.toLowerCase().includes('washout');
                 const isShopTime = activeDriveTime.shopTime === 'TRUE' || activeDriveTime.type?.toLowerCase().includes('shop');
                 
                 const finalTimesheet = {
                     ...activeDriveTime,
                     clockOut: new Date().toISOString(),
                     locationOut: `${latitude},${longitude}`,
                     distance: distance ? parseFloat(distance.toFixed(2)) : 0,
                     hours: distance > 0 ? parseFloat((distance / 55).toFixed(2)) : (isDumpWashout ? 0.50 : (isShopTime ? 0.25 : 0))
                 };

                 // OPTIMISTIC UPDATE: Update UI immediately
                 setDailySchedules(prev => prev.map(s => {
                     if (s._id !== schedule._id) return s;
                     return {
                         ...s,
                         timesheet: (s.timesheet || []).map((ts: any) => 
                             ts._id === activeDriveTime._id ? finalTimesheet : ts
                         )
                     };
                 }));
                 success('Drive Time Stopped');

                // API call in background
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveIndividualTimesheet',
                        payload: { timesheet: finalTimesheet }
                    })
                }).then(res => res.json()).then(data => {
                    if (!data.success) {
                        toastError(data.error || 'Failed to save - reverting');
                        fetchDailySchedules(scheduleDate);
                    }
                }).catch(() => {
                    toastError('Failed to save - reverting');
                    fetchDailySchedules(scheduleDate);
                });

            } else {
                // START DRIVE TIME
                const tempId = `temp-${Date.now()}`;
                const newTimesheet = {
                    _id: tempId,
                    scheduleId: schedule._id,
                    employee: employeeEmail,
                    clockIn: new Date().toISOString(),
                    locationIn: `${latitude},${longitude}`,
                    type: 'Drive Time',
                    status: 'Pending'
                };

                // OPTIMISTIC UPDATE: Update UI immediately
                setDailySchedules(prev => prev.map(s => {
                    if (s._id !== schedule._id) return s;
                    return {
                        ...s,
                        timesheet: [...(s.timesheet || []), newTimesheet]
                    };
                }));
                success('Drive Time Started');

                // API call in background
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveIndividualTimesheet',
                        payload: { timesheet: newTimesheet }
                    })
                }).then(res => res.json()).then(data => {
                    if (data.success && data.result) {
                        // Update with real ID from server
                        const savedTimesheet = data.result.timesheet?.find((ts: any) => 
                            ts.employee === employeeEmail && ts.clockIn === newTimesheet.clockIn
                        );
                        if (savedTimesheet) {
                            setDailySchedules(prev => prev.map(s => {
                                if (s._id !== schedule._id) return s;
                                return {
                                    ...s,
                                    timesheet: (s.timesheet || []).map((ts: any) => 
                                        ts._id === tempId ? { ...ts, _id: savedTimesheet._id } : ts
                                    )
                                };
                            }));
                        }
                    } else {
                        toastError(data.error || 'Failed to save - reverting');
                        setDailySchedules(prev => prev.map(s => {
                            if (s._id !== schedule._id) return s;
                            return {
                                ...s,
                                timesheet: (s.timesheet || []).filter((ts: any) => ts._id !== tempId)
                            };
                        }));
                    }
                }).catch(() => {
                    toastError('Failed to save - reverting');
                    setDailySchedules(prev => prev.map(s => {
                        if (s._id !== schedule._id) return s;
                        return {
                            ...s,
                            timesheet: (s.timesheet || []).filter((ts: any) => ts._id !== tempId)
                        };
                    }));
                });
            }
        } catch (error: any) {
            console.error(error);
            const msg = error?.message?.toLowerCase().includes('location') 
                ? "Location access denied or timed out. Please check your GPS settings."
                : "Unable to retrieve location or save data.";
            toastError(msg);
        }
    };
    
    const handleQuickTimesheet = async (schedule: any, type: 'Dump Washout' | 'Shop Time', e: React.MouseEvent) => {
        e.stopPropagation();
        
        let employeeEmail = currentUser?.email;
        if (!employeeEmail && typeof window !== 'undefined') {
             try {
                 employeeEmail = JSON.parse(localStorage.getItem('devco_user') || '{}')?.email;
             } catch (e) { console.error(e); }
        }
 
        if (!employeeEmail) {
            toastError("User identity not found.");
            return;
        }

        const hours = type === 'Dump Washout' ? 0.50 : 0.25;
        const now = new Date();
        const clockIn = new Date(now.getTime() - (hours * 60 * 60 * 1000)).toISOString();
        const clockOut = now.toISOString();

        const newTimesheet = {
            _id: `ts-${Date.now()}`,
            scheduleId: schedule._id,
            employee: employeeEmail,
            clockIn: clockIn,
            clockOut: clockOut,
            type: 'Drive Time',
            hours: hours,
            dumpWashout: type === 'Dump Washout' ? 'true' : undefined,
            shopTime: type === 'Shop Time' ? 'true' : undefined,
            status: 'Pending',
            createdAt: now.toISOString()
        };

        // Optimistic update
        setDailySchedules(prev => prev.map(s => {
            if (s._id !== schedule._id) return s;
            return {
                ...s,
                timesheet: [...(s.timesheet || []), newTimesheet]
            };
        }));

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveIndividualTimesheet',
                    payload: { timesheet: newTimesheet }
                })
            });
            const data = await res.json();
            if (data.success) {
                success(`${type} Registered`);
            } else {
                toastError(data.error || `Failed to save ${type}`);
                // Revert
                fetchDailySchedules(scheduleDate);
            }
        } catch (error) {
            console.error(error);
            toastError(`Error saving ${type}`);
            fetchDailySchedules(scheduleDate);
        }
    };

    const handleSaveJHAForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const currentEmail = typeof window !== 'undefined' 
                ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email
                : null;
            
            const payload = { 
                ...selectedJHA, 
                createdBy: selectedJHA.createdBy || currentEmail, 
                schedule_id: selectedJHA.schedule_id || selectedJHA._id 
            };
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('JHA Saved Successfully');
                fetchDailySchedules(scheduleDate);
                setIsJhaEditMode(false);
            } else {
                toastError(data.error || 'Failed to save JHA');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving JHA');
        }
    };

    const handleSaveJHASignature = async (dataUrl: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;
        let location = 'Unknown';
        if (navigator.geolocation) {
             try {
                 const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                     navigator.geolocation.getCurrentPosition(resolve, reject);
                 });
                 location = `${pos.coords.latitude},${pos.coords.longitude}`;
             } catch (e) {
                 console.log('Location access denied or failed');
             }
        }

        // Check if employee already signed to prevent duplicates
        if (selectedJHA.signatures?.some((s: any) => s.employee === activeSignatureEmployee)) {
            toastError('This employee has already signed.');
            setActiveSignatureEmployee(null); // Reset selection
            return;
        }
        try {
            const payload = {
                schedule_id: selectedJHA.schedule_id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email : null,
                location
            };
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHASignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                const newSig = data.result;
                setSelectedJHA((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), newSig] }));
                setActiveSignatureEmployee(null);
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving signature');
        }
    };

    const handleSaveDJTForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const currentEmail = typeof window !== 'undefined' 
                ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email
                : null;
            
            const payload = { 
                ...selectedDJT, 
                createdBy: selectedDJT.createdBy || currentEmail, 
                schedule_id: selectedDJT.schedule_id || selectedDJT._id 
            };
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJT', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('DJT Saved Successfully');
                fetchDailySchedules(scheduleDate);
                setIsDjtEditMode(false);
            } else {
                toastError(data.error || 'Failed to save DJT');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving DJT');
        }
    };

    const handleSaveDJTSignature = async (dataInput: string | any) => {
        if (!activeSignatureEmployee || !selectedDJT) return;
        
        const dataUrl = typeof dataInput === 'string' ? dataInput : dataInput.signature;
        const lunchStart = typeof dataInput === 'object' ? dataInput.lunchStart : null;
        const lunchEnd = typeof dataInput === 'object' ? dataInput.lunchEnd : null;

        setIsSavingSignature(true);
        let location = 'Unknown';
        if (navigator.geolocation) {
             try {
                 const pos = await Promise.race([
                     new Promise<GeolocationPosition>((resolve, reject) => {
                         navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
                     }),
                     new Promise<GeolocationPosition>((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 3000))
                 ]);
                 location = `${pos.coords.latitude},${pos.coords.longitude}`;
             } catch (e) {
                 console.log('Location access denied, failed, or timed out', e);
             }
        }
        
        try {
            const payload = {
                schedule_id: selectedDJT.schedule_id || selectedDJT._id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email : null,
            };
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJTSignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                const newSig = data.result;
                setSelectedDJT((prev: any) => ({ 
                    ...prev, 
                    signatures: [...(prev.signatures || []), newSig] 
                }));

                // Save Timesheet if lunch data provided
                if (lunchStart && lunchEnd) {
                    const scheduleId = selectedDJT.schedule_id || selectedDJT._id;
                    const schedule = dailySchedules.find(s => s._id === scheduleId);
                    
                    if (schedule) {
                        const clockInDate = new Date(schedule.fromDate);
                        const dateStr = clockInDate.toISOString().split('T')[0];
                        
                        const combineDateAndTime = (dateComponent: string, timeComponent: string) => {
                            return `${dateComponent}T${timeComponent}:00`; 
                        };

                        const timesheetPayload = {
                             scheduleId: schedule._id,
                             employee: activeSignatureEmployee,
                             clockIn: schedule.fromDate,
                             clockOut: new Date().toISOString(),
                             lunchStart: combineDateAndTime(dateStr, lunchStart),
                             lunchEnd: combineDateAndTime(dateStr, lunchEnd),
                             type: 'Site Time',
                             status: 'Pending'
                        };
                        
                         const tsRes = await fetch('/api/schedules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                action: 'saveIndividualTimesheet', 
                                payload: { timesheet: timesheetPayload } 
                            })
                        });
                        
                        const tsData = await tsRes.json();
                        if (tsData.success) {
                             success('Timesheet Record Created');
                             fetchDailySchedules(scheduleDate); 
                        } else {
                            console.error("Timesheet Error:", tsData.error);
                            if (tsData.error?.includes("already exists")) {
                                toastError('Timesheet already exists');
                            } else {
                                toastError('Failed to create timesheet record');
                            }
                        }
                    }
                }

                setActiveSignatureEmployee(null);
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving signature');
        } finally {
            setIsSavingSignature(false);
        }
    };

    const handleSaveIndividualTimesheet = async (e: React.FormEvent) => {
        e.preventDefault();

        let employeeEmail = selectedTimesheet.employee;
        if (!employeeEmail && typeof window !== 'undefined') {
             try {
                 employeeEmail = JSON.parse(localStorage.getItem('devco_user') || '{}')?.email;
             } catch(e) { console.error(e); }
        }

        if (!employeeEmail) {
            toastError("User email not found. Please reload or sign in.");
            return;
        }

        try {
            const timesheetData = {
                scheduleId: selectedTimesheet.scheduleId || selectedTimesheet._id,
                employee: employeeEmail,
                clockIn: selectedTimesheet.clockIn,
                clockOut: new Date().toISOString(), // Clocking out sets clockOut to now
                lunchStart: selectedTimesheet.lunchStartTime ? combineCurrentDateWithTime(selectedTimesheet.lunchStartTime) : null,
                lunchEnd: selectedTimesheet.lunchEndTime ? combineCurrentDateWithTime(selectedTimesheet.lunchEndTime) : null,
                comments: selectedTimesheet.comments,
                type: selectedTimesheet.type
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveIndividualTimesheet', payload: { timesheet: timesheetData } })
            });
            const data = await res.json();
            if (data.success) {
                success('Timesheet Registered');
                fetchDailySchedules(scheduleDate);
                setTimesheetModalOpen(false);
            } else {
                toastError(data.error || 'Failed to save timesheet');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving timesheet');
        }
    };

    const handleActivityClick = async (activity: any) => {
        if (activity.type === 'estimate') {
            router.push(`/estimates/${activity.entityId}`);
        } else if (activity.type === 'jha' || activity.type === 'jha_signature') {
             try {
                 const res = await fetch('/api/jha', {
                     method: 'POST',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({ action: 'getJHA', payload: { id: activity.entityId } })
                 });
                 const data = await res.json();
                 if (data.success && data.jha) {
                     setSelectedJHA(data.jha);
                     setJhaModalOpen(true);
                 } else {
                     router.push('/jobs/schedules');
                 }
             } catch(e) { console.error(e); }
        } else {
             router.push('/jobs/schedules');
        }
    };

    const getCustomerName = (item: any) => {
        if (item.customerName && item.customerName !== 'Client') return item.customerName;
        if (item.estimate) {
             const est = estimates.find(e => e.value === item.estimate);
             if (est && est.customerId) {
                 const client = clients.find(c => c._id === est.customerId);
                 if (client) return client.name;
             }
        }
        if (item.customerId) {
            const client = clients.find(c => c._id === item.customerId);
            if (client) return client.name;
        }
        return 'Client';
    };

    const fetchDailySchedules = async (date: Date) => {
        setScheduleLoading(true);
        const start = new Date(date);
        start.setHours(0,0,0,0);
        const end = new Date(date);
        end.setHours(23,59,59,999);

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getSchedulesPage',
                    payload: { 
                        startDate: start.toISOString(), 
                        endDate: end.toISOString(),
                        userEmail: currentUser?.email,
                        skipInitialData: constants.length > 0 && employees.length > 0
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                setDailySchedules(data.result.schedules || []);
                if (data.result.initialData) {
                    setConstants(data.result.initialData.constants || []);
                    setEmployees(data.result.initialData.employees || []);
                    setEstimates(data.result.initialData.estimates || []);
                    setClients(data.result.initialData.clients || []);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setScheduleLoading(false);
        }
    };

    useEffect(() => {
        fetchDailySchedules(scheduleDate);
    }, [scheduleDate]);

    useEffect(() => {
        setMounted(true);
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [estimatesRes, equipmentRes, laborRes, materialRes] = await Promise.all([
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getEstimates' })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'equipment' } })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'labor' } })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'material' } })
                })
            ]);

            const [estimatesData, equipmentData, laborData, materialData] = await Promise.all([
                estimatesRes.json(),
                equipmentRes.json(),
                laborRes.json(),
                materialRes.json()
            ]);

            const estimatesArr = estimatesData.success && estimatesData.result ? estimatesData.result : [];
            const equipment = equipmentData.success && equipmentData.result ? equipmentData.result.length : 0;
            const labor = laborData.success && laborData.result ? laborData.result.length : 0;
            const material = materialData.success && materialData.result ? materialData.result.length : 0;

            const totalValue = estimatesArr.reduce((sum: number, est: { grandTotal?: number }) => {
                return sum + (est.grandTotal || 0);
            }, 0);

            setStats({
                estimates: estimatesArr.length,
                activeEstimates: estimatesArr.filter((e: { status: string }) => e.status !== 'Completed' && e.status !== 'Rejected').length,
                completedEstimates: estimatesArr.filter((e: { status: string }) => e.status === 'Completed').length,
                catalogueItems: equipment + labor + material,
                equipmentItems: equipment,
                laborItems: labor,
                materialItems: material,
                totalValue
            });

            const activityRes = await fetch('/api/activity?days=7');
            const activityData = await activityRes.json();
            if (activityData.success) {
                setActivities(activityData.activities || []);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        setLoading(false);
    };

    const [activities, setActivities] = useState<any[]>([]);

    const getWeekDays = () => {
        const daysLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            result.push({
                label: daysLabel[d.getDay()],
                date: d.toDateString(),
                fullDate: d
            });
        }
        return result;
    };

    const weekDays = getWeekDays();
    
    const weeklyStats = weekDays.map(day => {
        const count = activities.filter(a => {
            const isSameDay = new Date(a.createdAt).toDateString() === day.date;
            const isCurrentUserMatch = !currentUser?.email || a.user === currentUser.email;
            return isSameDay && isCurrentUserMatch;
        }).length;
        return { label: day.label, value: count, date: day.date, fullDate: day.fullDate };
    });

    return (
        <div className="flex flex-col h-full">
            <div className="hidden md:block flex-none">
                <Header showDashboardActions={true} />
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] overflow-x-hidden">
                <div className="max-w-[1600px] mx-auto p-4 pt-14 md:pt-4">
                    <Tabs 
                        value={dashboardTab} 
                        onValueChange={(id) => setDashboardTab(id as 'activity' | 'jobschedule')}
                        className="w-full"
                    >
                        <div className="hidden md:flex mb-6 shrink-0">
                            <TabsList>
                                <TabsTrigger value="jobschedule">Job Schedule</TabsTrigger>
                                <TabsTrigger value="activity">Daily Activity</TabsTrigger>
                            </TabsList>
                        </div>
                        <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                            <TabsContent value="activity">
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm min-h-[500px]">
                                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Activity className="text-violet-500" />
                                    Recent Activity
                                </h3>
                                
                                {(() => {
                                    const filteredActivities = activities.filter(a => !currentUser?.email || a.user === currentUser.email);
                                    
                                    if (filteredActivities.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                    <Sparkles className="text-slate-300" size={32} />
                                                </div>
                                                <p className="text-slate-500 font-medium">No recent activity found</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="relative pl-4 max-w-2xl">
                                            <div className="absolute left-[22px] top-4 bottom-10 w-0.5 bg-slate-100" />
                                            
                                            {filteredActivities.map((activity, idx) => (
                                                <div key={idx} className="relative pl-12 mb-8 last:mb-0 group cursor-pointer" onClick={() => handleActivityClick(activity)}>
                                                    <div className="absolute left-0 top-0 w-11 h-11 rounded-full border-4 border-white shadow-sm bg-white flex items-center justify-center z-10 transition-transform group-hover:scale-110">
                                                        {(() => {
                                                            const emp = employees.find(e => e.value === activity.user || e.label === activity.user);
                                                            if (emp?.image) {
                                                                return <img src={emp.image} alt="" className="w-full h-full rounded-full object-cover" />;
                                                            }
                                                            return (
                                                                <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                                                    activity.type === 'estimate' ? 'bg-violet-500' :
                                                                    activity.type === 'jha' ? 'bg-emerald-500' :
                                                                    'bg-blue-500'
                                                                }`}>
                                                                    {(activity.user?.[0] || 'S').toUpperCase()}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-baseline justify-between mb-1">
                                                            <p className="text-sm font-bold text-slate-800">
                                                                {!activity.user || activity.user === 'system' ? 'Admin' : (employees.find(e => e.value === activity.user)?.label || activity.user)}
                                                            </p>
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                                                {new Date(activity.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-snug">
                                                            {activity.title}
                                                        </p>
                                                        
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                                                activity.type === 'estimate' ? 'bg-violet-50 text-violet-600' :
                                                                activity.type === 'jha' ? 'bg-emerald-50 text-emerald-600' :
                                                                'bg-blue-50 text-blue-600'
                                                            }`}>
                                                                {activity.type.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                </div>
                            </TabsContent>

                            <TabsContent value="jobschedule">
                                <div className="bg-white rounded-[32px] p-4 border border-slate-100 shadow-sm min-h-[500px] pb-6">
                                    <div className="flex items-center justify-between mb-5 px-2">
                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() - 1);
                                            setScheduleDate(d);
                                        }}
                                        className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    
                                    <div className="text-center cursor-pointer relative group" onClick={() => dateInputRef.current?.showPicker()}>
                                        <h3 className="text-2xl font-black text-slate-900 group-hover:text-[#0066FF] transition-colors mb-1" suppressHydrationWarning>
                                            {scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                        </h3>
                                        <p className="text-sm font-bold text-slate-400" suppressHydrationWarning>
                                            {scheduleDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <input 
                                            type="date"
                                            ref={dateInputRef}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                            value={mounted ? scheduleDate.toISOString().split('T')[0] : ''}
                                            suppressHydrationWarning
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                                    setScheduleDate(new Date(y, m - 1, d));
                                                }
                                            }} 
                                        />
                                    </div>

                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() + 1);
                                            setScheduleDate(d);
                                        }}
                                        className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {scheduleLoading ? (
                                        [1,2,3,4,5,6].map(i => (
                                            <div key={i} className="animate-pulse bg-slate-50 h-64 rounded-[40px]" />
                                        ))
                                    ) : filteredDailySchedules.length === 0 ? (
                                        <div className="col-span-full">
                                            <EmptyState 
                                                icon="📅" 
                                                title="No schedules found" 
                                                message="No jobs scheduled for this date matching your role."
                                                action={
                                                    <button 
                                                        onClick={() => router.push('/jobs/schedules')}
                                                        className="mt-4 px-4 py-2 bg-[#0F4C75] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-[#0b3a59] transition-colors"
                                                    >
                                                        View All Schedules
                                                    </button>
                                                }
                                            />
                                        </div>
                                    ) : (
                                        filteredDailySchedules.map((item, i) => (
                                            <div
                                                key={item._id || i}
                                                onClick={() => setSelectedSchedule(item)}
                                                className="group relative bg-white rounded-[24px] sm:rounded-[40px] p-4 cursor-pointer transition-all duration-300 transform border border-slate-100 hover:border-[#0F4C75]/30 hover:-translate-y-1 shadow-sm"
                                            >
                                                <div className="flex flex-col h-full justify-between">
                                                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            {(() => {
                                                                const tagConstant = constants.find(c => c.description === item.item);
                                                                const tagImage = tagConstant?.image;
                                                                const tagColor = tagConstant?.color;
                                                                const tagLabel = item.item || item.service || 'S';

                                                                if (tagImage) {
                                                                    return (
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    );
                                                                } else if (tagColor) {
                                                                    return (
                                                                        <div
                                                                            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,0.5)] flex items-center justify-center text-white font-black text-xs sm:text-sm"
                                                                            style={{ backgroundColor: tagColor }}
                                                                        >
                                                                            {tagLabel.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-[#E6EEF8] shadow-[inset_5px_5px_10px_#d1d9e6,inset_-5px_-5px_10px_#ffffff] flex items-center justify-center text-[#0F4C75] font-black text-xs sm:text-sm">
                                                                            {tagLabel.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                            <div className="flex flex-col">
                                                                <span className="text-xs sm:text-sm font-bold text-slate-500 leading-tight">{getCustomerName(item)}</span>
                                                                {(() => {
                                                                    const est = estimates.find(e => e.value === item.estimate);
                                                                    if (est?.jobAddress) {
                                                                        return (
                                                                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                                                {est.jobAddress}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Title (smaller font) */}
                                                    <div className="mb-2">
                                                        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight line-clamp-2">
                                                            {item.title || 'Untitled Schedule'}
                                                        </h3>
                                                    </div>

                                                    {/* Row 3: Estimate # & Date/Time */}
                                                    {/* Row 3: Estimate #, Date/Time & Assignees */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {item.estimate && (
                                                                <span className="text-[10px] sm:text-[11px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                                                    {item.estimate.replace(/-[vV]\d+$/, '')}
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-500" suppressHydrationWarning>
                                                                <span>{new Date(item.fromDate).toLocaleDateString()}</span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>{new Date(item.fromDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                                                <span>-</span>
                                                                <span>{new Date(item.toDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                                            </div>
                                                        </div>

                                                        {/* Assignees - Right aligned */}
                                                        <div className="flex -space-x-1.5 shrink-0">
                                                            {(item.assignees || []).filter(Boolean).slice(0, 3).map((email: string, i: number) => {
                                                                const emp = employees.find(e => e.value === email);
                                                                return (
                                                                    <Tooltip key={i}>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[8px] font-bold shadow-sm overflow-hidden bg-slate-200 text-slate-600">
                                                                                {emp?.image ? (
                                                                                    <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    email?.[0]?.toUpperCase() || '?'
                                                                                )}
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{emp?.label || email}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                            {(item.assignees || []).filter(Boolean).length > 3 && (
                                                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-500 shadow-sm">
                                                                    +{(item.assignees?.filter(Boolean).length || 0) - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Bottom: Actions & Personnel */}
                                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                                        {/* Actions: JHA, DJT, Timesheet */}
                                                        <div className="flex items-center gap-3">
                                                            {/* JHA */}
                                                            {item.hasJHA ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div 
                                                                            className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const jhaWithSigs = { 
                                                                                    ...item.jha, 
                                                                                    signatures: item.JHASignatures || [] 
                                                                                };
                                                                                setSelectedJHA(jhaWithSigs);
                                                                                setIsJhaEditMode(false);
                                                                                setJhaModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <ShieldCheck size={18} strokeWidth={2.5} />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>View JHA</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div 
                                                                            className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedJHA({
                                                                                    schedule_id: item._id,
                                                                                    date: new Date(),
                                                                                    jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false }), // Default time
                                                                                    emailCounter: 0,
                                                                                    signatures: [], // Empty signatures initially
                                                                                    scheduleRef: item // Pass reference for assignees access
                                                                                });
                                                                                setIsJhaEditMode(true);
                                                                                setJhaModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <Shield size={18} strokeWidth={2.5} />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Create JHA</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}

                                                            {/* DJT */}
                                                            {item.hasDJT ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div 
                                                                            className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const djtWithSigs = { 
                                                                                    ...item.djt, 
                                                                                    signatures: item.DJTSignatures || [] 
                                                                                };
                                                                                setSelectedDJT(djtWithSigs);
                                                                                setIsDjtEditMode(false);
                                                                                setDjtModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <FileCheck size={18} strokeWidth={2.5} />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>View DJT</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div 
                                                                            className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedDJT({
                                                                                    schedule_id: item._id,
                                                                                    dailyJobDescription: '',
                                                                                    customerPrintName: '',
                                                                                    customerSignature: '',
                                                                                    createdBy: currentUser?.email,
                                                                                    clientEmail: '',
                                                                                    emailCounter: 0
                                                                                });
                                                                                setIsDjtEditMode(true);
                                                                                setDjtModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <FilePlus size={18} strokeWidth={2.5} />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Create DJT</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                            
                                                             {/* Timesheet */}
                                                            {(() => {
                                                                const userTimesheets = item.timesheet?.filter((ts: any) => ts.employee === currentUser?.email) || [];
                                                                const activeDriveTime = userTimesheets.find((ts: any) => (ts.type === 'Drive Time' || ts.type === 'Drive Time') && !ts.clockOut);
                                                                const hasDumpWashout = userTimesheets.some((ts: any) => String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true || String(ts.dumpWashout).toLowerCase() === 'yes');
                                                                const hasShopTime = userTimesheets.some((ts: any) => String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true);
                                                                
                                                                // Priority: 1. Active Drive Time (Stop Button) -> 2. Existing Records (View Button) -> 3. No Records (Start Drive Time)
                                                                
                                                                if (activeDriveTime) {
                                                                    return (
                                                                        <>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <div 
                                                                                        className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer border-2 border-white shadow-sm animate-pulse" 
                                                                                        onClick={(e) => handleDriveTimeToggle(item, activeDriveTime, e)}
                                                                                    >
                                                                                        <StopCircle size={18} strokeWidth={2.5} />
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>Stop Drive Time</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
        
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <div 
                                                                                        className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-colors border-2 border-white shadow-sm ${hasDumpWashout ? 'bg-teal-500 text-white cursor-not-allowed opacity-70' : 'bg-slate-100 text-slate-400 hover:bg-teal-100 hover:text-teal-600 cursor-pointer'}`} 
                                                                                        onClick={(e) => !hasDumpWashout && handleQuickTimesheet(item, 'Dump Washout', e)}
                                                                                    >
                                                                                        <Droplets size={18} strokeWidth={2.5} />
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>{hasDumpWashout ? 'Dump Washout Registered' : 'Dump Washout'}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
        
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <div 
                                                                                        className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-colors border-2 border-white shadow-sm ${hasShopTime ? 'bg-amber-500 text-white cursor-not-allowed opacity-70' : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600 cursor-pointer'}`} 
                                                                                        onClick={(e) => !hasShopTime && handleQuickTimesheet(item, 'Shop Time', e)}
                                                                                    >
                                                                                        <Warehouse size={18} strokeWidth={2.5} />
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>{hasShopTime ? 'Shop Time Registered' : 'Shop Time'}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </>
                                                                    );
                                                                }
                                                                
                                                                return (
                                                                    <>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div 
                                                                                    className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-sky-100 hover:text-sky-600 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                                                    onClick={(e) => handleDriveTimeToggle(item, null, e)}
                                                                                >
                                                                                    <Car size={18} strokeWidth={2.5} />
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Start Drive Time</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
        
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div 
                                                                                    className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-colors border-2 border-white shadow-sm ${hasDumpWashout ? 'bg-teal-500 text-white cursor-not-allowed opacity-70' : 'bg-slate-100 text-slate-400 hover:bg-teal-100 hover:text-teal-600 cursor-pointer'}`} 
                                                                                    onClick={(e) => !hasDumpWashout && handleQuickTimesheet(item, 'Dump Washout', e)}
                                                                                >
                                                                                    <Droplets size={18} strokeWidth={2.5} />
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{hasDumpWashout ? 'Dump Washout Registered' : 'Dump Washout'}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
        
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div 
                                                                                    className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-colors border-2 border-white shadow-sm ${hasShopTime ? 'bg-amber-500 text-white cursor-not-allowed opacity-70' : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600 cursor-pointer'}`} 
                                                                                    onClick={(e) => !hasShopTime && handleQuickTimesheet(item, 'Shop Time', e)}
                                                                                >
                                                                                    <Warehouse size={18} strokeWidth={2.5} />
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{hasShopTime ? 'Shop Time Registered' : 'Shop Time'}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </>
                                                                );
                                                            })()}
                                                </div>

                                                        {/* PM / Foreman - right side */}
                                                        <div className="flex items-center gap-2">
                                                             {/* PM and Foreman */}
                                                                 {[item.projectManager, item.foremanName].map((email, i) => {
                                                                    if (!email) return null;
                                                                    const emp = employees.find(e => e.value === email);
                                                                    const labels = ['P', 'F']; 
                                                                    const colors = ['bg-[#0F4C75]', 'bg-[#10B981]'];
                                                                    
                                                                    return (
                                                                        <Tooltip key={i}>
                                                                            <TooltipTrigger asChild>
                                                                                <div
                                                                                    className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold shadow-sm overflow-hidden text-white ${colors[i]}`}
                                                                                >
                                                                                    {emp?.image ? (
                                                                                        <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        labels[i]
                                                                                    )}
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{`${i === 0 ? 'Project Manager' : 'Foreman'}: ${emp?.label || email}`}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
                </div>
            </div>

            {/* Modals from original dashboard remain the same, just adjust some internal references if needed */}
            {selectedSchedule && (
                <Modal
                    isOpen={!!selectedSchedule}
                    onClose={() => setSelectedSchedule(null)}
                    title="Job Details"
                    maxWidth="2xl"
                >
                    <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        {/* 1. Tag + Client */}
                        <div className="flex items-center gap-4">
                            {(() => {
                                const tagConstant = constants.find(c => c.description === selectedSchedule.item);
                                const tagImage = tagConstant?.image;
                                const tagColor = tagConstant?.color;
                                const tagLabel = selectedSchedule.item || selectedSchedule.service || 'S';

                                if (tagImage) {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                        </div>
                                    );
                                } else if (tagColor) {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full shadow-sm flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: tagColor }}>
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[#0F4C75] font-black text-sm">
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                }
                            })()}
                            <div>
                                <p className="text-xl font-black text-[#0F4C75] leading-none mb-1">{getCustomerName(selectedSchedule)}</p>
                            </div>
                        </div>

                        {/* 2. Job Address */}
                        {(() => {
                            const est = estimates.find(e => e.value === selectedSchedule.estimate);
                            const displayAddress = est?.jobAddress;
                            if (displayAddress && displayAddress !== 'N/A') {
                                return (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 mb-1">{displayAddress}</p>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* 3. Title */}
                        <div>
                            <p className="text-base font-black text-slate-800 leading-tight">{selectedSchedule.title}</p>
                        </div>

                        {/* 4. Estimate + FromDate + Times */}
                        <div className="flex items-center gap-3">
                            {selectedSchedule.estimate && (
                                <Badge variant="info" className="py-0 h-5">{selectedSchedule.estimate.replace(/-[vV]\d+$/, '')}</Badge>
                            )}
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-700" suppressHydrationWarning>
                                    From: {new Date(selectedSchedule.fromDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                                {selectedSchedule.toDate && (
                                    <>
                                        <span className="text-xs font-bold text-slate-400">-</span>
                                        <span className="text-xs font-bold text-slate-700" suppressHydrationWarning>
                                            {new Date(selectedSchedule.toDate).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        {/* 5. PM + Foreman */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { label: 'Project Manager', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' }
                            ].map((role, idx) => {
                                if (!role.val) return null;
                                const emp = employees.find(e => e.value === role.val);
                                return (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || role.val[0])}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{role.label}</p>
                                            <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        {/* 6. Assignees */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assignees</p>
                            <div className="flex flex-wrap gap-2">
                                {(selectedSchedule.assignees || []).map((assignee: string, i: number) => {
                                    const emp = employees.find(e => e.value === assignee);
                                    return (
                                        <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                                            <div className="w-6 h-6 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || assignee[0])}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{emp?.label || assignee}</span>
                                        </div>
                                    );
                                })}
                                {(!selectedSchedule.assignees || selectedSchedule.assignees.length === 0) && (
                                    <span className="text-xs text-slate-400 italic">No assignees</span>
                                )}
                            </div>
                        </div>

                        {/* 7. Service + Tag + Per Diem + Certified Payroll */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Service</p>
                                <Badge variant="default" className="text-slate-600 bg-slate-50 border-slate-200">{selectedSchedule.service || 'N/A'}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tag</p>
                                <Badge className="bg-[#E6EEF8] text-[#0F4C75] hover:bg-[#dbe6f5] border-none">{selectedSchedule.item || 'N/A'}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Per Diem</p>
                                <Badge variant={selectedSchedule.perDiem === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selectedSchedule.perDiem === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    {selectedSchedule.perDiem || 'No'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Certified Payroll</p>
                                <Badge variant={selectedSchedule.certifiedPayroll === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selectedSchedule.certifiedPayroll === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    {selectedSchedule.certifiedPayroll || 'No'}
                                </Badge>
                            </div>
                        </div>

                        {/* 8. Today's Objectives */}
                        {selectedSchedule.todayObjectives && selectedSchedule.todayObjectives.length > 0 && (
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Today&apos;s Objectives</p>
                                <div className="space-y-2">
                                    {selectedSchedule.todayObjectives.map((obj: any, i: number) => {
                                        const isCompleted = typeof obj === 'string' ? false : obj.completed;
                                        const text = typeof obj === 'string' ? obj : obj.text;
                                        return (
                                            <div 
                                                key={i} 
                                                className="flex items-start gap-2 cursor-pointer group"
                                                onClick={() => handleToggleObjective(selectedSchedule._id, i, isCompleted)}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 fill-orange-100" />
                                                ) : (
                                                    <Circle className="w-5 h-5 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors" />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className={`text-xs sm:text-sm ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                                        {text}
                                                    </span>
                                                    {typeof obj !== 'string' && obj.completed && obj.completedBy && (
                                                        <span className="text-[10px] text-slate-400">
                                                            Completed by {obj.completedBy}
                                                            {obj.completedAt && ` at ${new Date(obj.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 9. Aerial Image + Site Layout */}
                        {(selectedSchedule.aerialImage || selectedSchedule.siteLayout) && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedSchedule.aerialImage && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aerial Image</p>
                                            <div 
                                                className="relative group cursor-pointer"
                                                onClick={() => setMediaModal({ isOpen: true, type: 'image', url: selectedSchedule.aerialImage!, title: 'Aerial Site View' })}
                                            >
                                                <img 
                                                    src={selectedSchedule.aerialImage} 
                                                    alt="Aerial View" 
                                                    className="w-full h-44 object-cover rounded-xl border border-slate-200 group-hover:opacity-90 transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {selectedSchedule.siteLayout && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">3D Site Preview</p>
                                            <div 
                                                className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                                                onClick={() => {
                                                    const earthUrl = selectedSchedule.siteLayout!;
                                                    const coordsMatch = earthUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                    const lat = coordsMatch?.[1];
                                                    const lng = coordsMatch?.[2];
                                                    const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                                    if (embedUrl) {
                                                        setMediaModal({ isOpen: true, type: 'map', url: embedUrl, title: 'Interactive Site Layout' });
                                                    } else {
                                                        window.open(earthUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <MapPin size={24} className="text-blue-600 mb-2" />
                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight text-center">Open Site Layout</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 10. Scope of Work */}
                        {selectedSchedule.description && (
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope of Work</p>
                                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    {selectedSchedule.description}
                                </p>
                            </div>
                        )}

                        {/* 11. Timesheets */}
                        {selectedSchedule.timesheet && selectedSchedule.timesheet.length > 0 && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timesheet History</p>
                                    <Badge variant="default" className="bg-slate-100 text-slate-500 border-none">{selectedSchedule.timesheet.length} Entries</Badge>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                    {selectedSchedule.timesheet.map((ts: any, idx: number) => {
                                        const emp = employees.find(e => e.value === ts.employee);
                                        const isDW = String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true || String(ts.dumpWashout).toLowerCase() === 'yes';
                                        const isST = String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true;
                                        
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                                        {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-400">{emp?.label?.[0] || 'U'}</span>}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{emp?.label || ts.employee}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{ts.type || 'Other'}</span>
                                                            {isDW && <Droplets size={10} className="text-teal-500" />}
                                                            {isST && <Warehouse size={10} className="text-amber-500" />}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-[#0F4C75]">{ts.hours ? ts.hours.toFixed(2) : '-'} hrs</p>
                                                    <p className="text-[9px] font-bold text-slate-400">{new Date(ts.clockIn).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            <Modal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                title="Job Hazard Analysis (JHA)"
                maxWidth="4xl"
            >
                {selectedJHA ? (
                    isJhaEditMode ? (
                        <form onSubmit={handleSaveJHAForm} className="space-y-6">
                            {/* Header Inputs (Hidden Date/Time, keeping others) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">USA No.</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.usaNo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, usaNo: e.target.value})}
                                        placeholder="Enter USA No."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subcontractor USA</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.subcontractorUSANo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, subcontractorUSANo: e.target.value})}
                                        placeholder="Enter Subcontractor USA"
                                    />
                                </div>
                            </div>

                            {/* Section: Daily Work */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-3 mb-4">Daily Work</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'operatingMiniEx', label: 'Operating Mini Ex' },
                                        { key: 'operatingAVacuumTruck', label: 'Vacuum Truck' },
                                        { key: 'excavatingTrenching', label: 'Excavating/Trenching' },
                                        { key: 'acConcWork', label: 'AC/Concrete Work' },
                                        { key: 'operatingBackhoe', label: 'Operating Backhoe' },
                                        { key: 'workingInATrench', label: 'Working in Trench' },
                                        { key: 'trafficControl', label: 'Traffic Control' },
                                        { key: 'roadWork', label: 'Road Work' },
                                        { key: 'operatingHdd', label: 'Operating HDD' },
                                        { key: 'confinedSpace', label: 'Confined Space' },
                                        { key: 'settingUgBoxes', label: 'Setting UG Boxes' },
                                        { key: 'otherDailyWork', label: 'Other Daily Work' },
                                    ].map((item) => (
                                        <div key={item.key} className="space-y-2">
                                            <label className={`p-4 h-full rounded-2xl border flex items-center gap-4 cursor-pointer transition-all duration-300 ${(selectedJHA as any)[item.key] ? 'bg-[#0F4C75]/5 border-[#0F4C75] shadow-[0_4px_12px_rgba(15,76,117,0.08)]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-[#0F4C75] rounded-lg border-slate-300 focus:ring-[#0F4C75]"
                                                    checked={!!(selectedJHA as any)[item.key]}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                                />
                                                <span className={`text-sm font-bold ${(selectedJHA as any)[item.key] ? 'text-[#0F4C75]' : 'text-slate-600'}`}>{item.label}</span>
                                            </label>
                                            {item.key === 'otherDailyWork' && (selectedJHA as any).otherDailyWork && (
                                                <textarea
                                                    className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                                    placeholder="Specify Other Daily Work..."
                                                    rows={2}
                                                    value={(selectedJHA as any).commentsOtherDailyWork || ''}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, commentsOtherDailyWork: e.target.value })}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Jobsite Hazards */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-3 mb-4">Jobsite Hazards</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'sidewalks', label: 'Sidewalks', commentKey: 'commentsOnSidewalks' },
                                        { key: 'heatAwareness', label: 'Heat Awareness', commentKey: 'commentsOnHeatAwareness' },
                                        { key: 'ladderWork', label: 'Ladder Work', commentKey: 'commentsOnLadderWork' },
                                        { key: 'overheadLifting', label: 'Overhead Lifting', commentKey: 'commentsOnOverheadLifting' },
                                        { key: 'materialHandling', label: 'Material Handling', commentKey: 'commentsOnMaterialHandling' },
                                        { key: 'roadHazards', label: 'Road Hazards', commentKey: 'commentsOnRoadHazards' },
                                        { key: 'heavyLifting', label: 'Heavy Lifting', commentKey: 'commentsOnHeavyLifting' },
                                        { key: 'highNoise', label: 'High Noise', commentKey: 'commentsOnHighNoise' },
                                        { key: 'pinchPoints', label: 'Pinch Points', commentKey: 'commentsOnPinchPoints' },
                                        { key: 'sharpObjects', label: 'Sharp Objects', commentKey: 'commentsOnSharpObjects' },
                                        { key: 'trippingHazards', label: 'Tripping Hazards', commentKey: 'commentsOnTrippingHazards' },
                                        { key: 'otherJobsiteHazards', label: 'Other Jobsite Hazards', commentKey: 'commentsOnOther' },
                                    ].map((item) => (
                                        <div key={item.key} className="space-y-2">
                                            <label className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all duration-300 ${(selectedJHA as any)[item.key] ? 'bg-orange-50 border-orange-500 shadow-[0_4px_12px_rgba(249,115,22,0.1)]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-orange-600 rounded-lg border-slate-300 focus:ring-orange-600"
                                                    checked={!!(selectedJHA as any)[item.key]}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                                />
                                                <span className={`text-sm font-bold ${(selectedJHA as any)[item.key] ? 'text-orange-900' : 'text-slate-600'}`}>{item.label}</span>
                                            </label>
                                            {!!(selectedJHA as any)[item.key] && (
                                                <div className="animate-fade-in-down">
                                                    <textarea
                                                        className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-600 transition-all"
                                                        placeholder={`Comments for ${item.label}...`}
                                                        rows={2}
                                                        value={(selectedJHA as any)[item.commentKey] || ''}
                                                        onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.commentKey]: e.target.value })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Any Specific Notes</label>
                                    <textarea
                                        className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all resize-none shadow-sm"
                                        placeholder="Additional notes for jobsite hazards..."
                                        rows={3}
                                        value={selectedJHA.anySpecificNotes || ''}
                                        onChange={(e) => setSelectedJHA({ ...selectedJHA, anySpecificNotes: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Section: Emergency Action Plan */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-3 mb-4">Emergency Action Plan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                     {[
                                        { key: 'stagingAreaDiscussed', label: 'Staging Area Discussed' },
                                        { key: 'rescueProceduresDiscussed', label: 'Rescue Procedures Discussed' },
                                        { key: 'evacuationRoutesDiscussed', label: 'Evacuation Routes Discussed' },
                                        { key: 'emergencyContactNumberWillBe911', label: 'Emergency Contact is 911' },
                                        { key: 'firstAidAndCPREquipmentOnsite', label: 'First Aid/CPR Onsite' },
                                        { key: 'closestHospitalDiscussed', label: 'Closest Hospital Discussed' },
                                     ].map((item) => (
                                        <label key={item.key} className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all duration-300 ${(selectedJHA as any)[item.key] ? 'bg-emerald-50 border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.1)]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 text-emerald-600 rounded-lg border-slate-300 focus:ring-emerald-600"
                                                checked={!!(selectedJHA as any)[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className={`text-sm font-bold ${(selectedJHA as any)[item.key] ? 'text-emerald-900' : 'text-slate-700'}`}>{item.label}</span>
                                        </label>
                                     ))}
                                </div>
                            </div>

                            {/* Section: Hospital */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-2">Hospital Information</h4>
                                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-red-500 uppercase block mb-1.5">Nearest Hospital Name</label>
                                        <input 
                                            type="text"
                                            className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                                            value={selectedJHA.nameOfHospital || ''}
                                            onChange={(e) => setSelectedJHA({...selectedJHA, nameOfHospital: e.target.value})}
                                            placeholder="Enter Hospital Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-red-500 uppercase block mb-1.5">Hospital Address</label>
                                        <input 
                                            type="text"
                                            className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                                            value={selectedJHA.addressOfHospital || ''}
                                            onChange={(e) => setSelectedJHA({...selectedJHA, addressOfHospital: e.target.value})}
                                            placeholder="Enter Hospital Address"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Signatures (Now at the bottom) */}
                            <div className="border rounded-xl p-4 border-slate-200 bg-blue-50/50">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-blue-100 pb-2 flex justify-between">
                                    <span>Signatures</span>
                                    <span className="text-[10px] font-normal text-slate-500 normal-case">All assignees must sign</span>
                                </h4>
                                
                                {activeSignatureEmployee ? (
                                    <div className="max-w-md mx-auto">
                                        <SignaturePad 
                                            employeeName={employees.find(e => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                            onSave={handleSaveJHASignature} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveSignatureEmployee(null)} 
                                            className="mt-2 w-full text-xs text-slate-500 hover:text-slate-800 font-bold"
                                        >
                                            Cancel Signing
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {(() => {
                                            const schedule = dailySchedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
                                            const assignees = schedule?.assignees || [];
                                            const uniqueAssignees = Array.from(new Set(assignees)).filter(Boolean) as string[];

                                            return uniqueAssignees.map((email: string) => {
                                                const emp = employees.find(e => e.value === email);
                                                const sig = selectedJHA.signatures?.find((s: any) => s.employee === email);
                                                
                                                return (
                                                    <div key={email} className={`relative p-3 rounded-xl border transition-all ${sig ? 'bg-white border-green-200 shadow-sm' : 'bg-white border-dashed border-slate-300 hover:border-[#0F4C75]'}`}>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-white shadow-sm flex items-center justify-center shrink-0">
                                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || email}</p>
                                                                <p className="text-[10px] text-slate-400">{sig ? 'Signed' : 'Pending Signature'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {sig ? (
                                                            <div className="h-12 border-t border-slate-50 mt-2 flex items-center justify-center">
                                                                <img src={sig.signature} className="max-h-full max-w-full object-contain opacity-80" />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                className="w-full py-1.5 mt-1 text-xs font-bold text-white bg-[#0F4C75] hover:bg-[#0b3d61] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                                            >
                                                                <FilePlus size={12} /> Sign Now
                                                            </button>
                                                        )}
                                                        {sig && (
                                                             <div className="absolute top-2 right-2 text-green-500"><CheckCircle2 size={14} /></div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-4 pb-[calc(env(safe-area-inset-bottom,20px)+2rem)] border-t border-slate-100">
                                <button
                                    type="submit"
                                    className="px-8 py-3 bg-[#0F4C75] hover:bg-[#0b3d61] text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                                >
                                    Save Entire JHA
                                </button>
                            </div>
                        </form>
                    ) : (
                    <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Section 1: JHA Info */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-200 pb-2 flex flex-wrap justify-between items-center gap-2">
                                <span>JHA Info</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsJhaEditMode(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm"
                                    >
                                        <Edit size={12} />
                                        EDIT JHA
                                    </button>
                                    <button
                                        onClick={() => setEmailModalOpen(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all shadow-sm"
                                    >
                                        <Mail size={12} />
                                        EMAIL PDF
                                    </button>
                                    <button
                                        onClick={handleDownloadJhaPdf}
                                        disabled={isGeneratingJHAPDF}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all shadow-sm disabled:opacity-50"
                                    >
                                        {isGeneratingJHAPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        DOWNLOAD PDF
                                    </button>
                                </div>
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Date</p><p className="text-sm font-bold text-slate-700">{new Date(selectedJHA.date || Date.now()).toLocaleDateString()}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Time</p><p className="text-sm font-bold text-slate-700">{selectedJHA.jhaTime}</p></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Created By</p>
                                    {(() => {
                                        const creator = employees.find(e => e.value === selectedJHA.createdBy);
                                        if (creator) {
                                            return (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                        {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 truncate">{creator.label}</p>
                                                </div>
                                            );
                                        }
                                        return <p className="text-sm font-bold text-slate-700 truncate">{selectedJHA.createdBy || 'Unknown'}</p>;
                                    })()}
                                </div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">USA No.</p><p className="text-sm font-bold text-slate-700">{selectedJHA.usaNo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Subcontractor USA</p><p className="text-sm font-bold text-slate-700">{selectedJHA.subcontractorUSANo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Client Email</p><p className="text-sm font-bold text-slate-700">{selectedJHA.clientEmail || '-'}</p></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Emailed</p>
                                    <div className="flex items-center gap-2 mt-0.5 group relative">
                                        <p className="text-sm font-bold text-slate-700">{selectedJHA.emailCounter || 0} times</p>
                                        {selectedJHA.emailCounter > 0 && selectedJHA.jhaEmails && (
                                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-xl text-xs">
                                                <p className="font-bold border-b border-slate-700 pb-1 mb-2">Email History</p>
                                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {selectedJHA.jhaEmails.slice().reverse().map((email: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-start gap-2">
                                                            <span className="truncate flex-1 text-slate-300">{email.emailto}</span>
                                                            <span className="text-[10px] text-slate-500 shrink-0">{new Date(email.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Daily Work */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { label: 'Operating Mini Ex', val: selectedJHA.operatingMiniEx },
                                    { label: 'Vacuum Truck', val: selectedJHA.operatingAVacuumTruck },
                                    { label: 'Excavating/Trenching', val: selectedJHA.excavatingTrenching },
                                    { label: 'AC/Concrete Work', val: selectedJHA.acConcWork },
                                    { label: 'Operating Backhoe', val: selectedJHA.operatingBackhoe },
                                    { label: 'Working in Trench', val: selectedJHA.workingInATrench },
                                    { label: 'Traffic Control', val: selectedJHA.trafficControl },
                                    { label: 'Road Work', val: selectedJHA.roadWork },
                                    { label: 'Operating HDD', val: selectedJHA.operatingHdd },
                                    { label: 'Confined Space', val: selectedJHA.confinedSpace },
                                    { label: 'Setting UG Boxes', val: selectedJHA.settingUgBoxes },
                                    { label: 'Other Daily Work', val: selectedJHA.otherDailyWork, comment: selectedJHA.commentsOtherDailyWork },
                                ].map((item, i) => (
                                    <div key={i} className={`p-3 rounded-lg border flex flex-col gap-2 ${item.val ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100 opacity-60'}`}>
                                        <div className="flex items-center gap-2">
                                            {item.val ? <CheckCircle2 size={16} className="text-blue-600 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                                            <span className={`text-xs font-bold ${item.val ? 'text-blue-900' : 'text-slate-500'}`}>{item.label}</span>
                                        </div>
                                        {item.val && item.comment && (
                                            <p className="text-[10px] italic text-slate-600 bg-white/50 p-1.5 rounded ml-6 border border-blue-100/50">{item.comment}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Jobsite Hazards */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {[
                                    { label: 'Sidewalks', val: selectedJHA.sidewalks, c: selectedJHA.commentsOnSidewalks },
                                    { label: 'Heat Awareness', val: selectedJHA.heatAwareness, c: selectedJHA.commentsOnHeatAwareness },
                                    { label: 'Ladder Work', val: selectedJHA.ladderWork, c: selectedJHA.commentsOnLadderWork },
                                    { label: 'Overhead Lifting', val: selectedJHA.overheadLifting, c: selectedJHA.commentsOnOverheadLifting },
                                    { label: 'Material Handling', val: selectedJHA.materialHandling, c: selectedJHA.commentsOnMaterialHandling },
                                    { label: 'Road Hazards', val: selectedJHA.roadHazards, c: selectedJHA.commentsOnRoadHazards },
                                    { label: 'Heavy Lifting', val: selectedJHA.heavyLifting, c: selectedJHA.commentsOnHeavyLifting },
                                    { label: 'High Noise', val: selectedJHA.highNoise, c: selectedJHA.commentsOnHighNoise },
                                    { label: 'Pinch Points', val: selectedJHA.pinchPoints, c: selectedJHA.commentsOnPinchPoints },
                                    { label: 'Sharp Objects', val: selectedJHA.sharpObjects, c: selectedJHA.commentsOnSharpObjects },
                                    { label: 'Tripping Hazards', val: selectedJHA.trippingHazards, c: selectedJHA.commentsOnTrippingHazards },
                                    { label: 'Other Hazards', val: selectedJHA.otherJobsiteHazards, c: selectedJHA.commentsOnOther },
                                ].map((item, i) => (
                                    <div key={i} className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {item.val ? <AlertCircle size={14} className="text-orange-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                                <span className={`text-xs font-bold ${item.val ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.val ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {item.val ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                        {item.c && (
                                            <div className="pl-6 text-[11px] text-slate-600 bg-orange-50/50 p-2 rounded border border-orange-100/50 mt-1">
                                                <span className="font-semibold text-orange-800/70">Note:</span> {item.c}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedJHA.anySpecificNotes && (
                                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <p className="text-xs font-bold text-yellow-800 mb-1">Specific Notes:</p>
                                    <p className="text-xs text-yellow-900/80">{selectedJHA.anySpecificNotes}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Section 4: Emergency Action Plan */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Action Plan</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Staging Area Discussed', val: selectedJHA.stagingAreaDiscussed },
                                        { label: 'Rescue Procedures Discussed', val: selectedJHA.rescueProceduresDiscussed },
                                        { label: 'Evacuation Routes Discussed', val: selectedJHA.evacuationRoutesDiscussed },
                                        { label: 'Emergency Contact is 911', val: selectedJHA.emergencyContactNumberWillBe911 },
                                        { label: 'First Aid & CPR Equipment Onsite', val: selectedJHA.firstAidAndCPREquipmentOnsite },
                                        { label: 'Closest Hospital Discussed', val: selectedJHA.closestHospitalDiscussed },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                            <span className="text-xs font-medium text-slate-700">{item.label}</span>
                                            {item.val ? 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                    <CheckCircle2 size={10} /> DONE
                                                </div> 
                                                : 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-1 rounded-full">
                                                    PENDING
                                                </div>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 5: Hospital */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Hospital Information</h4>
                                <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Nearest Hospital</p>
                                            <p className="text-base font-black text-red-900 mb-1">{selectedJHA.nameOfHospital || 'Not Specified'}</p>
                                            <p className="text-sm text-red-800/80 leading-relaxed">{selectedJHA.addressOfHospital || 'No address provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 6: Signatures */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Employee Signatures</h4>
                            {selectedJHA.signatures && selectedJHA.signatures.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {selectedJHA.signatures.map((sig: any, index: number) => {
                                        const emp = employees.find(e => e.value === sig.employee);
                                        return (
                                            <div key={index} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-all">
                                                <div className="w-full h-24 bg-slate-50 rounded border border-slate-100 flex items-center justify-center overflow-hidden relative">
                                                    {sig.signature ? (
                                                        <img src={sig.signature} alt="Signature" className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No Image</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                     <div className="w-5 h-5 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                                        {emp?.image ? (
                                                            <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0] || 'U'}</span>
                                                        )}
                                                     </div>
                                                     <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                                                               {emp?.label || sig.employee}
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{emp?.label || sig.employee}</p>
                                                        </TooltipContent>
                                                     </Tooltip>
                                                </div>

                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(sig.createdAt || Date.now()).toLocaleString('en-US', { 
                                                        year: 'numeric', 
                                                        month: 'numeric', 
                                                        day: 'numeric', 
                                                        hour: 'numeric', 
                                                        minute: 'numeric', 
                                                        hour12: true 
                                                    })}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-400 italic">No signatures recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    )
                ) : (
                    <EmptyState title="No Data" message="Unable to load JHA details." />
                )}
            </Modal>


            {/* Daily Job Ticket Modal */}
            <DJTModal
                isOpen={djtModalOpen}
                onClose={() => setDjtModalOpen(false)}
                selectedDJT={selectedDJT}
                setSelectedDJT={setSelectedDJT}
                isEditMode={isDjtEditMode}
                setIsEditMode={setIsDjtEditMode}
                handleSave={handleSaveDJTForm}
                handleSaveSignature={handleSaveDJTSignature}
                initialData={{ employees }}
                isSavingSignature={isSavingSignature}
                schedules={dailySchedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
            />

            {/* Individual Timesheet Modal */}
            <TimesheetModal
                isOpen={timesheetModalOpen}
                onClose={() => setTimesheetModalOpen(false)}
                selectedTimesheet={selectedTimesheet}
                setSelectedTimesheet={setSelectedTimesheet}
                isEditMode={isTimesheetEditMode}
                setIsEditMode={setIsTimesheetEditMode}
                handleSave={handleSaveIndividualTimesheet}
            />

            {/* Media Modal */}
            <Modal
                isOpen={mediaModal.isOpen}
                onClose={() => setMediaModal({ ...mediaModal, isOpen: false })}
                title={mediaModal.title}
                maxWidth={mediaModal.type === 'map' ? '6xl' : '4xl'}
            >
                <div className="p-1">
                    {mediaModal.type === 'image' ? (
                        <img 
                            src={mediaModal.url} 
                            alt={mediaModal.title} 
                            className="w-full h-auto rounded-xl shadow-2xl border border-slate-200"
                        />
                    ) : (
                        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100">
                            <iframe
                                src={mediaModal.url}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                className="w-full h-full"
                            />
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                        {mediaModal.type === 'map' && (
                            <a 
                                href={mediaModal.url.replace('&output=embed', '').replace('output=embed', '')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg hover:shadow-blue-200/50 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <MapPin size={18} />
                                Open in Google Earth
                            </a>
                        )}
                        <button
                            onClick={() => setMediaModal({ ...mediaModal, isOpen: false })}
                            className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Email JHA Modal */}
            <Modal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                title="Email JHA Document"
                maxWidth="md"
            >
                <form onSubmit={handleEmailJhaPdf} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                            <Mail size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                            <p className="text-xs text-blue-800/70 mt-1">The JHA document will be attached as a PDF and sent to the recipient below.</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Recipient Email</label>
                        <input 
                            type="email"
                            required
                            className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                            placeholder="Enter email address"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <button
                            type="button"
                            onClick={() => setEmailModalOpen(false)}
                            disabled={isSendingEmail}
                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSendingEmail}
                            className="px-6 py-2 bg-[#0F4C75] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-[#0b3c5e] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            {isSendingEmail ? 'Sending...' : 'Send Email'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
