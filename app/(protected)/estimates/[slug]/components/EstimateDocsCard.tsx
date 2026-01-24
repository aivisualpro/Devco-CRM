'use client';

import React, { useState } from 'react';
import { FileText, Shield, ChevronRight, Loader2, Download, Layout, FileCheck, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';

// Google Doc Template IDs
const DOC_TEMPLATES: Record<string, string> = {
    '20 Day Prelim': '1tkVNaR45XBFatu7WSn7LUpmsLS8G5aqy9IO5xtlQcAA',
    'CP - Conditional Release (Progress)': '1HER_h4JAsp-WOB6VGOK8eq9UAr9mib58RcTWt1gwC70',
    'COI - Certificate of Insurance': '',
    'CF - Conditional Release (Final)': '1NXMwX1PAmYFjdzSBwXbPq3jRgFjgUE00zFfpZWrSi5Y',
    'UP - Unconditional Release (Progress)': '1UDSOXcvBirMqQGN1v6Q1lJOBFfO6p2V0r-KRF8OGs-A',
    'UF - Unconditional Release (Final)': '',
    'Mechanics Lien': '',
    'Intent to Lien': '',
    'Fringe Benefit Statement': '',
    'DAS 140': '',
    'Certified Payroll Report': '',
    'PW Docs & PLA Agreement': '',
    'DAS 142': '',
    'Fringe Benefits Report': '',
    'Union Status Letter': '',
    // Add more templates here as needed
};

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    companyPosition?: string;
    signature?: string;
    [key: string]: any;
}

interface EstimateDocsCardProps {
    className?: string;
    formData?: Record<string, any>;
    employees?: Employee[];
}

export const EstimateDocsCard: React.FC<EstimateDocsCardProps> = ({ className, formData, employees = [] }) => {
    const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

    const prelimDocs = [
        '20 Day Prelim',
        'CP - Conditional Release (Progress)',
        'COI - Certificate of Insurance',
        'CF - Conditional Release (Final)',
        'UP - Unconditional Release (Progress)',
        'UF - Unconditional Release (Final)',
        'Mechanics Lien',
        'Intent to Lien'
    ];

    const certifiedPayrollDocs = [
        'Fringe Benefit Statement',
        'DAS 140',
        'Certified Payroll Report',
        'PW Docs & PLA Agreement',
        'DAS 142',
        'Fringe Benefits Report',
        'Union Status Letter',
        'Proof of DAS 140 & 142 Sent',
        'Checklist of Labor Law Requirements',
        'Certificate of Compliance',
        'DIR Registration',
        'List of Subcontractors',
        'Subcontractor CPR',
        'Authorized Signatory',
        'Skilled & Trained Reporting',
        'Fringe Benefits Proof of Payment'
    ];

    const planningDocs: string[] = [];
    const signedContractsDocs: string[] = [];
    const receiptsAndCostsDocs: string[] = [];

    const handleDocClick = async (docName: string) => {
        const templateId = DOC_TEMPLATES[docName];
        
        if (!templateId) {
            toast.error(`Template not configured for "${docName}"`);
            return;
        }

        if (!formData) {
            toast.error('No estimate data available');
            return;
        }

        setGeneratingDoc(docName);

        try {
            // Build variables from formData
            const variables: Record<string, string> = {
                // Job Info
                jobAddress: formData.jobAddress || '',
                projectDescription: formData.projectDescription || '',
                prelimAmount: formData.prelimAmount || '',
                date: formData.date || new Date().toLocaleDateString(),
                
                // Property Owner / Public Agency
                poName: formData.poName || '',
                PoAddress: formData.PoAddress || '',
                PoPhone: formData.PoPhone || '',
                
                // Original Contractor
                ocName: formData.ocName || '',
                ocAddress: formData.ocAddress || '',
                ocPhone: formData.ocPhone || '',
                
                // Sub-Contractor
                subCName: formData.subCName || '',
                subCAddress: formData.subCAddress || '',
                subCPhone: formData.subCPhone || '',
                
                // Lending Institution
                liName: formData.liName || '',
                liAddress: formData.liAddress || '',
                liPhone: formData.liPhone || '',
                
                // Surety Company
                scName: formData.scName || '',
                scAddress: formData.scAddress || '',
                scPhone: formData.scPhone || '',
                bondNumber: formData.bondNumber || '',
                
                // Fringe Benefits Trust
                fbName: formData.fbName || '',
                fbAddress: formData.fbAddress || '',
                
                // Certified Payroll
                certifiedPayroll: formData.certifiedPayroll || '',
                
                // Customer Info
                customerName: formData.customerName || '',
                contactName: formData.contactName || '',
                contactEmail: formData.contactEmail || '',
                contactPhone: formData.contactPhone || '',
                
                // Project
                projectName: formData.projectName || '',
                estimate: formData.estimate || '',
                usaNumber: formData.usaNumber || '',
                
                // Get proposalWriter employee details
                createdBy: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        if (emp) {
                            return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                        }
                    }
                    return formData.proposalWriter || '';
                })(),
                position: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.companyPosition || '';
                    }
                    return '';
                })(),
                signature: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.signature || '';
                    }
                    return '';
                })(),
            };

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate PDF');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docName.replace(/\s+/g, '_')}_${formData.estimate || 'doc'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast.success(`${docName} downloaded successfully!`);
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            toast.error(error.message || 'Failed to generate PDF');
        } finally {
            setGeneratingDoc(null);
        }
    };

    return (
        <div className={`bg-[#eef2f6] rounded-[40px] p-4 ${className || ''}`}>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Column 1: Prelims */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                            <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#0F4C75]">Prelims</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                            {prelimDocs.length}
                        </span>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {prelimDocs.length > 0 ? prelimDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Certified Payroll */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md">
                            <Shield className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-700">Certified Payroll</h4>
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                            {certifiedPayrollDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {certifiedPayrollDocs.length > 0 ? certifiedPayrollDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isPayroll={true}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Planning */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center shadow-md">
                            <Layout className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-violet-700">Planning</h4>
                        <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">
                            {planningDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {planningDocs.length > 0 ? planningDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 4: Signed Contracts */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                            <FileCheck className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-700">Signed Contracts</h4>
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                            {signedContractsDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {signedContractsDocs.length > 0 ? signedContractsDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 5: Receipts & Costs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center shadow-md">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-pink-700">Receipts & Costs</h4>
                        <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-bold">
                            {receiptsAndCostsDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {receiptsAndCostsDocs.length > 0 ? receiptsAndCostsDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface DocCardProps {
    label: string;
    isPayroll?: boolean;
    isLoading?: boolean;
    hasTemplate?: boolean;
    onClick?: () => void;
}

const DocCard: React.FC<DocCardProps> = ({ label, isPayroll, isLoading, hasTemplate, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            className={`
                group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
                ${isLoading 
                    ? 'bg-blue-50 shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                    : isHovered 
                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                        : 'bg-white/60 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]'
                }
            `}
        >
            {/* Content */}
            <p className={`flex-1 text-xs font-bold leading-snug transition-colors ${isHovered || isLoading ? 'text-[#0F4C75]' : 'text-slate-600'}`}>
                {label}
            </p>

            {/* Status Icon */}
            {isLoading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            ) : hasTemplate ? (
                <Download className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75]' : 'text-slate-300'}`} />
            ) : (
                <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75] translate-x-1' : 'text-slate-300'}`} />
            )}
        </div>
    );
};
