import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { resolveTemplate, resolveTemplateDocument } from '@/lib/templateResolver';
import {
    Estimate,
    EquipmentItem,
    LaborItem,
    MaterialItem,
    OverheadItem,
    SubcontractorItem,
    DisposalItem,
    MiscellaneousItem,
    ToolItem,
    Constant,
    Counter,
    Client,
    Schedule,
    Employee,
    Template,
    GlobalCustomVariable,
    Activity,
} from '@/lib/models';

import { v2 as cloudinary } from 'cloudinary';
import { uploadToR2, removeFromR2 } from '@/lib/s3';
// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function deleteFromCloudinary(url: string): Promise<boolean> {
    if (!url || !url.includes('cloudinary.com')) return false;
    try {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return false;

        let startIndex = uploadIndex + 1;
        // Skip transformation or version segments
        while (startIndex < parts.length) {
            const segment = parts[startIndex];
            if (segment.match(/^v\d+$/) || segment.includes(',') || segment.includes('_')) {
                startIndex++;
            } else {
                break;
            }
        }

        const pathWithExt = parts.slice(startIndex).join('/');
        const publicId = pathWithExt.replace(/\.[^/.]+$/, "");

        await cloudinary.uploader.destroy(publicId);
        return true;
    } catch (error) {
        console.error('Cloudinary Delete Error:', error);
        return false;
    }
}

async function uploadImage(imageString: string, publicId: string): Promise<string | null> {
    if (!imageString || !imageString.startsWith('data:image')) return imageString;

    try {
        const safeId = publicId.replace(/[^a-zA-Z0-9]/g, '_');
        const uploadResult = await cloudinary.uploader.upload(imageString, {
            public_id: `employees/${safeId}`,
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" }
            ]
        });
        return uploadResult.secure_url;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        return null;
    }
}

async function uploadThumbnail(fileString: string, publicId: string, contentType: string): Promise<string | null> {
    if (!fileString) return null;

    try {
        const safeId = publicId.replace(/[^a-zA-Z0-9]/g, '_');
        const isPDF = contentType.includes('pdf') || fileString.startsWith('data:application/pdf');
        const isImage = contentType.startsWith('image/') || fileString.startsWith('data:image');

        if (isImage || isPDF) {
            const uploadResult = await cloudinary.uploader.upload(fileString, {
                public_id: safeId,
                folder: 'thumbnails',
                overwrite: true,
                resource_type: isPDF ? 'auto' : 'image',
                transformation: [
                    { width: 400, height: 533, crop: 'fill', gravity: 'north', format: 'png', page: 1 }
                ]
            });

            let url = uploadResult.secure_url;
            if (isPDF) {
                url = url.replace(/\.[^/.]+$/, ".png");
            }
            return url;
        }

        if (contentType.includes('word') || contentType.includes('officedocument.wordprocessingml')) {
            return 'https://res.cloudinary.com/dff9f7q8o/image/upload/v1711200000/word_icon.png';
        }
        if (contentType.includes('excel') || contentType.includes('officedocument.spreadsheetml')) {
            return 'https://res.cloudinary.com/dff9f7q8o/image/upload/v1711200000/excel_icon.png';
        }

        return null;
    } catch (error) {
        console.error('Thumbnail Upload Error:', error);
        return null;
    }
}

async function uploadRawToCloudinary(fileString: string, fileName: string, contentType: string): Promise<{ url: string; thumbnailUrl: string } | null> {
    if (!fileString) return null;
    try {
        const safeId = fileName.replace(/[^a-zA-Z0-9]/g, '_');
        
        const uploadResult = await cloudinary.uploader.upload(fileString, {
            folder: 'signed_contracts',
            public_id: safeId,
            resource_type: 'auto'
        });

        const mainUrl = uploadResult.secure_url;
        let thumbUrl = mainUrl;

        const isPDF = contentType.includes('pdf') || fileString.startsWith('data:application/pdf');
        const isImage = contentType.startsWith('image/') || fileString.startsWith('data:image');

        if (isPDF) {
            const thumbResult = await cloudinary.uploader.upload(fileString, {
                public_id: `${safeId}_thumb`,
                folder: 'signed_contracts/thumbnails',
                resource_type: 'auto',
                transformation: [
                    { width: 400, height: 533, crop: 'fill', gravity: 'north', format: 'png', page: 1 }
                ]
            });
            thumbUrl = thumbResult.secure_url.replace(/\.[^/.]+$/, ".png");
        } else if (isImage) {
            thumbUrl = mainUrl;
        } else if (contentType.includes('csv')) {
            thumbUrl = 'https://img.icons8.com/color/480/csv.png';
        } else if (contentType.includes('excel') || contentType.includes('officedocument.spreadsheetml')) {
            thumbUrl = 'https://img.icons8.com/color/480/xlsx.png';
        } else if (contentType.includes('word') || contentType.includes('officedocument.wordprocessingml')) {
            thumbUrl = 'https://img.icons8.com/color/480/docx.png';
        }

        return { url: mainUrl, thumbnailUrl: thumbUrl };
    } catch (error) {
        console.error('Raw Cloudinary Upload Error:', error);
        return null;
    }
}

export async function uploadDocumentToR2(base64String: string, fileName: string, contentType: string) {
    return await uploadToR2(base64String, `documents/${fileName}`, contentType);
}

const getAppSheetConfig = () => ({
    appId: process.env.APPSHEET_APP_ID || "3a1353f3-966e-467d-8947-a4a4d0c4c0c5",
    accessKey: process.env.APPSHEET_ACCESS || "V2-lWtLA-VV7bn-bEktT-S5xM7-2WUIf-UQmIA-GY6qH-A1S3E",
    tableName: process.env.APSHEET_ESTIMATE_TABLE || "Customer Jobs"
});

const getAppSheetClientConfig = () => ({
    appId: process.env.APPSHEET_APP_ID || "3a1353f3-966e-467d-8947-a4a4d0c4c0c5",
    accessKey: process.env.APPSHEET_ACCESS || "V2-lWtLA-VV7bn-bEktT-S5xM7-2WUIf-UQmIA-GY6qH-A1S3E",
    tableName: process.env.APSHEET_CUSTOMERS_TABLE || "Customers"
});

function toBoolean(value: unknown): boolean {
    if (value === 'Y' || value === 'y' || value === true) return true;
    return false;
}
function toYN(value: boolean): string {
    return value === true ? 'Y' : 'N';
}

function parseNum(val: unknown): number {
    return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
}

// AppSheet sync helper
async function updateAppSheet(data: any, lineItems: Record<string, unknown[]> | null = null, action: "Add" | "Edit" | "Delete" = "Edit") {
    // 1. Production Check
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[AppSheet] Skipping ${action} sync: Not in production environment.`);
        return { success: true, skipped: true };
    }

    const { appId, accessKey, tableName } = getAppSheetConfig();

    if (!appId || !accessKey) {
        console.error('[AppSheet] Missing credentials');
        return { success: false, skipped: true, reason: "No AppSheet credentials" };
    }

    // 2. Prepare Data Mapping
    // Ensure we handle numeric fields safely with formatting
    const fmtMoney = (val: any) => (parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0).toFixed(2);
    
    // Mapping keys to AppSheet columns as requested
    const appSheetRow = {
        "Proposal Number": String(data.estimate || ""), 
        "Project Name": String(data.projectName || ""),
        "Proposal Writer": String(data.proposalWriter || ""),
        "Client": String(data.customerId || ""),
        "Customer Job Number": String(data.customerJobNumber || ""),
        "Client Contact Full Name": String(data.contactName || ""),
        "Client Contact Email": String(data.contactEmail || ""),
        "Client Contact Phone": String(data.contactPhone || ""),
        "Accounting Contact": String(data.accountingContact || ""),
        "Accounting email": String(data.accountingEmail || ""),
        "PO Name": String(data.poName || ""),
        "PO Address": String(data.PoAddress || ""),
        "PO Phone": String(data.PoPhone || ""),
        "OC Name": String(data.ocName || ""),
        "OC Address": String(data.ocAddress || ""),
        "OC Phone": String(data.ocPhone || ""),
        "SubC Name": String(data.subCName || ""),
        "SubC Address": String(data.subCAddress || ""),
        "SubC Phone": String(data.subCPhone || ""),
        "LI Name": String(data.liName || ""),
        "LI Address": String(data.liAddress || ""),
        "LI Phone": String(data.liPhone || ""),
        "SC Name": String(data.scName || ""),
        "SC Address": String(data.scAddress || ""),
        "SC Phone": String(data.scPhone || ""),
        "Bond Number": String(data.bondNumber || ""),
        "Job Location / Address": String(data.jobAddress || ""),
        "Labor Agreement": String(data.fringe || ""),
        "Certified Payroll": String(data.certifiedPayroll || ""),
        "Prevailing Wage": data.prevailingWage === true ? "Yes" : "No",
        "Project ID": String(data.projectId || ""),
        "FB Name": String(data.fbName || ""),
        "FB Address": String(data.fbAddress || ""),
        "e-CPR System": String(data.eCPRSystem || ""),
        "Wet Utilities": String(data.wetUtilities || ""),
        "Dry Utilities": String(data.dryUtilities || ""),
        "Project Description": String(data.projectDescription || ""),
        "Estimated start date": String(data.estimatedStartDate || ""),
        "Estimated completion date": String(data.estimatedCompletionDate || ""),
        "Site Conditions": String(data.siteConditions || ""),
        "Date": String(data.date || ""),
        "Status": String(data.status || ""),
        "Prelim Amount": String(data.prelimAmount || ""),
        "Billing Terms": String(data.billingTerms || ""),
        "Other Billing Terms": String(data.otherBillingTerms || ""),
        "Total Estimated Cost": fmtMoney(data.grandTotal),
        "extension": String(data.extension || "")
    };

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;

    try {
        console.log(`[AppSheet] Syncing ${action} for Estimate #${data.estimate}...`);
        
        const response = await fetch(APPSHEET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApplicationAccessKey": accessKey
            },
            body: JSON.stringify({
                Action: action,
                Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                Rows: [appSheetRow]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AppSheet] Error ${response.status}:`, errorText);
            return { success: false, status: response.status, error: `AppSheet ${response.status}: ${errorText}` };
        }
        
        console.log(`[AppSheet] Sync Success`);
        return { success: true };
    } catch (error) {
        console.error("[AppSheet] Network/Execution Error:", error);
        return { success: false, error: String(error) };
    }
}

// AppSheet Client Sync Helper
async function updateAppSheetClient(data: any | any[], action: "Add" | "Edit" | "Delete" = "Edit") {
    if (process.env.NODE_ENV !== 'production') {
         console.log(`[AppSheet Client] Skipping ${action} sync: Not in production environment.`);
         return; 
    }

    const { appId, accessKey, tableName } = getAppSheetClientConfig();
    if (!appId || !accessKey) return;

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    const rows = items.map((client: any) => {
        // Extract Primary Contact
        const contacts = Array.isArray(client.contacts) ? client.contacts : [];
        const primaryContact = contacts.find((c: any) => c.primary) || contacts.find((c: any) => c.active) || contacts[0] || {};
        
        // Extract Accounting Contact
        const accountingContact = contacts.find((c: any) => c.type === 'Accounting') || {};

        return {
            "Record_ID": String(client._id || ""),
            "Name": String(client.name || ""),
            "Business Address": String(client.businessAddress || ""),
            "Proposal Writer": String(client.proposalWriter || ""),
            "Contact Full Name": String(primaryContact.name || ""),
            "Email": String(primaryContact.email || ""),
            "Phone": String(primaryContact.phone || ""),
            "Accounting Contact": String(accountingContact.name || ""),
            "Accounting email": String(accountingContact.email || ""),
            "Status": String(client.status || "")
        };
    });

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;

    try {
        await fetch(APPSHEET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApplicationAccessKey": accessKey
            },
            body: JSON.stringify({
                Action: action,
                Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                Rows: rows
            })
        });
        console.log(`[AppSheet Client] Synced ${action} for ${rows.length} clients.`);
    } catch (error) {
        console.error("[AppSheet Client] Error:", error);
    }
}

// Catalogue type to model mapping
function getCatalogueModel(type: string) {
    const models: Record<string, typeof EquipmentItem> = {
        equipment: EquipmentItem,
        labor: LaborItem,
        material: MaterialItem,
        overhead: OverheadItem,
        subcontractor: SubcontractorItem,
        disposal: DisposalItem,
        miscellaneous: MiscellaneousItem,
        tools: ToolItem,
        constant: Constant as unknown as typeof EquipmentItem
    };
    return models[type];
}

// Helper to normalize services (trim, unique, sorted)
function normalizeServices(services: any): string[] {
    if (!Array.isArray(services)) return [];
    const unique = Array.from(new Set(services.map((s: any) => String(s).trim()).filter(Boolean)));
    return unique.sort();
}

// Helper to check for template service conflicts
async function checkTemplateServicesConflict(services: string[], excludeId?: string) {
    if (!services || services.length === 0) return null;
    
    // Use $size for exact array length and $all to ensure all specific services match
    return await Template.findOne({
        services: { $size: services.length, $all: services },
        ...(excludeId ? { _id: { $ne: excludeId } } : {})
    }).lean();
}

export async function POST(request: NextRequest) {
    let action = 'unknown';
    try {
        const text = await request.text();
        if (!text) {
            return NextResponse.json({ success: false, error: 'Empty body' }, { status: 400 });
        }
        const body = JSON.parse(text);
        const { action: bodyAction, payload, Data } = body;
        action = bodyAction || action;

        await connectToDatabase();
        const { getEmptyTemplate } = await import('@/lib/templateResolver');

        // Helper to enrich estimate with Client's primary address for contactAddress
        const enrichEstimate = async (est: any) => {
            if (est && est.customerId) {
                try {
                    const client = await Client.findById(est.customerId).lean();
                    if (client) {
                        // Determine Primary Address
                        const primaryAddrObj = (client.addresses || []).find((a: any) => a.primary) || client.addresses?.[0];
                        const primaryAddress = primaryAddrObj ? (typeof primaryAddrObj === 'string' ? primaryAddrObj : primaryAddrObj.address) : (client.businessAddress || '');

                        if (primaryAddress) {
                            est.contactAddress = primaryAddress;
                        }
                    }
                } catch (e) {
                    console.error("Error enriching estimate with client details", e);
                }
            }
            return est;
        };

        // Handle AppSheet webhook payload
        if (Data && Data.recordId) {
            const docData = {
                _id: Data.recordId,
                estimate: Data.estimate,
                date: Data.date,
                customerId: Data.customerId,
                customerName: Data.customerName,
                proposalNo: Data.proposalNo,
                bidMarkUp: Data.bidMarkUp,

                fringe: Data.fringe,
                updatedAt: new Date()
            };

            const result = await Estimate.findByIdAndUpdate(
                Data.recordId,
                docData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            return NextResponse.json({ success: true, result: { id: result._id, data: result } });
        }

        // Action handling
        switch (action) {
            // ========== ESTIMATES ==========
            case 'getEstimatesByCustomerId': {
                const { customerId } = payload || {};
                if (!customerId) return NextResponse.json({ success: false, error: 'Missing customerId' }, { status: 400 });

                const estimates = await Estimate.find({ customerId }).sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: estimates });
            }

            case 'getEstimates': {
                const estimates = await Estimate.find().sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: estimates });
            }

            case 'getEstimateStats': {
                // Aggregate estimates by status with count and total grandTotal
                const stats = await Estimate.aggregate([
                    { $match: { status: { $ne: 'deleted' } } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            total: { $sum: { $ifNull: ['$grandTotal', 0] } }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            status: '$_id',
                            count: 1,
                            total: 1
                        }
                    },
                    { $sort: { total: -1 } }
                ]);
                return NextResponse.json({ success: true, result: stats });
            }

            case 'getEstimateById': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const est = await Estimate.findById(id).lean();
                if (!est) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

                // With embedded documents, we simply return the estimate
                // Ensure arrays exist
                const result = {
                    ...est,
                    labor: (est as any).labor || [],
                    equipment: (est as any).equipment || [],
                    material: (est as any).material || [],
                    tools: (est as any).tools || [],
                    overhead: (est as any).overhead || [],
                    subcontractor: (est as any).subcontractor || [],
                    disposal: (est as any).disposal || [],
                    miscellaneous: (est as any).miscellaneous || []
                };

                return NextResponse.json({ success: true, result });
            }

            case 'getEstimateBySlug': {
                const { slug } = payload || {};
                if (!slug) return NextResponse.json({ success: false, error: 'Missing slug' }, { status: 400 });

                // Try by ID first (works for V1-CO1 etc)
                let est = await Estimate.findById(slug).lean();

                if (!est) {
                    // Fallback to slug parsing: EstimateNumber-V[VersionNumber]
                    const lastIndex = slug.lastIndexOf('-V');
                    if (lastIndex !== -1) {
                        const estimateNumber = slug.substring(0, lastIndex);
                        const versionStr = slug.substring(lastIndex + 2);
                        const versionNumber = parseInt(versionStr, 10);

                        if (!isNaN(versionNumber)) {
                            est = await Estimate.findOne({ estimate: estimateNumber, versionNumber }).lean();
                        }
                    }
                }

                if (!est) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

                // Ensure arrays exist
                const result = {
                    ...est,
                    labor: (est as any).labor || [],
                    equipment: (est as any).equipment || [],
                    material: (est as any).material || [],
                    tools: (est as any).tools || [],
                    overhead: (est as any).overhead || [],
                    subcontractor: (est as any).subcontractor || [],
                    disposal: (est as any).disposal || [],
                    miscellaneous: (est as any).miscellaneous || []
                };

                return NextResponse.json({ success: true, result });
            }

            case 'getEstimatesByProposal': {
                const { estimateNumber } = payload || {};
                if (!estimateNumber) return NextResponse.json({ success: false, error: 'Missing estimateNumber' }, { status: 400 });

                const estimates = await Estimate.find({ estimate: estimateNumber }).sort({ createdAt: 1 }).lean();

                // Add version numbers and calculate totals
                const versioned = estimates.map((est, idx) => {
                    const e = est as unknown as Record<string, unknown>;

                    let dateStr = '';

                    // 1. Prefer explicit 'date' field from document (Historical/Manual Date)
                    if (e.date) {
                        const dateString = String(e.date);
                        const d = new Date(dateString);

                        if (!isNaN(d.getTime())) {
                            // Standard parse success
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            dateStr = `${month}/${day}/${year}`;
                        } else {
                            // Check for DD/MM/YYYY legacy manual format (e.g., 16/06/2025)
                            const parts = dateString.split('/');
                            if (parts.length === 3) {
                                // Assume DD/MM/YYYY
                                dateStr = `${parts[1]}/${parts[0]}/${parts[2]}`;
                            } else {
                                // Keep raw as fallback
                                dateStr = dateString;
                            }
                        }
                    }

                    // 2. Fallback to 'createdAt' if date is missing
                    if (!dateStr) {
                        const created = e.createdAt ? new Date(e.createdAt as string | Date) : new Date();
                        const day = String(created.getDate()).padStart(2, '0');
                        const month = String(created.getMonth() + 1).padStart(2, '0');
                        const year = created.getFullYear();
                        dateStr = `${month}/${day}/${year}`;
                    }

                    return {
                        _id: String(e._id),
                        estimate: e.estimate,
                        proposalNo: e.proposalNo,
                        versionNumber: (e.versionNumber as number) || (idx + 1),
                        date: dateStr,
                        totalAmount: parseNum(e.grandTotal) || 0,
                        status: e.status,
                        isChangeOrder: e.isChangeOrder === true,
                        parentVersionId: e.parentVersionId
                    };
                });

                return NextResponse.json({ success: true, result: versioned });
            }

            case 'createEstimate': {
                // Get current year (last 2 digits)
                const currentYear = new Date().getFullYear();
                const yearSuffix = currentYear.toString().slice(-2);
                const startSeq = 1;

                // GAP FILLING LOGIC:
                // Find already used sequences for this year to fill any gaps (e.g., if 634 is deleted, reuse it)
                const regex = new RegExp(`^${yearSuffix}-`);
                const existingEstimates = await Estimate.find({ estimate: { $regex: regex } })
                    .select('estimate')
                    .lean(); // Use lean for speed

                const usedSequences = new Set<number>();
                existingEstimates.forEach((doc: any) => {
                    if (doc.estimate) {
                        const parts = doc.estimate.split('-');
                        if (parts.length === 2) {
                            const seq = parseInt(parts[1], 10);
                            if (!isNaN(seq)) {
                                usedSequences.add(seq);
                            }
                        }
                    }
                });

                // Start from base 633 and find first one NOT in the set
                let nextSeq = startSeq;
                while (usedSequences.has(nextSeq)) {
                    nextSeq++;
                }

                const estimateNumber = `${yearSuffix}-${String(nextSeq).padStart(4, '0')}`;

                const id = `${estimateNumber}-V1`;

                const estimateData = {
                    ...payload,
                    _id: id,
                    estimate: estimateNumber,
                    date: payload?.date || new Date().toLocaleDateString(),
                    customerName: payload?.customerName || '',
                    proposalNo: payload?.proposalNo || estimateNumber,
                    bidMarkUp: '30%',
                    status: 'pending',
                    versionNumber: 1,
                    // Initialize empty arrays
                    labor: [],
                    equipment: [],
                    material: [],
                    tools: [],
                    overhead: [],
                    subcontractor: [],
                    disposal: [],
                    miscellaneous: [],

                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                // Ensure createdBy is set
                if (!(estimateData as any).createdBy && (estimateData as any).proposalWriter) {
                    (estimateData as any).createdBy = (estimateData as any).proposalWriter;
                }

                const est = await Estimate.create(estimateData) as any;

                // Log Activity
                try {
                    const activityId = new Types.ObjectId().toString();
                    await Activity.create({
                        _id: activityId,
                        user: (() => {
                            const u = (estimateData as any).proposalWriter || (estimateData as any).createdBy || '';
                            return Array.isArray(u) ? u.join(', ') : String(u);
                        })(),
                        action: 'created_estimate',
                        type: 'estimate',
                        title: `Created Estimate #${est.estimate}`,
                        entityId: est.estimate, // Use estimate number or _id. Used number for display often, but ID for link. 
                        // Actually, dashboard link uses ID/slug. If estimate number is unique, good. But usually ID is safer. 
                        // If entityId is used for link /estimates/[slug], and [slug] can be ID or estimate#, then estimate# is fine if unique.
                        // Let's use est.estimate (string) as it's cleaner for user.
                        metadata: { estimate_id: est._id },
                        createdAt: new Date()
                    });
                } catch (e) {
                    console.error('Failed to log activity:', e);
                }
                updateAppSheet(est, null, "Add").catch(err => console.error('Background AppSheet sync failed:', err));

                return NextResponse.json({ success: true, result: est });
            }

            case 'syncToAppSheet': {
                // Only sync to AppSheet on production (Vercel)
                if (process.env.NODE_ENV !== 'production') {
                    return NextResponse.json({ success: false, error: 'AppSheet sync only works on production' });
                }

                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Estimate ID is required' });

                const est = await Estimate.findById(id).lean();
                if (!est) return NextResponse.json({ success: false, error: 'Estimate not found' });

                console.log(`[AppSheet Manual Sync] Syncing Estimate: ${id}`);

                // Try Add first
                const addResult = await updateAppSheet(est, null, "Add");

                if (!addResult.success && !addResult.skipped) {
                    const errorStr = String(addResult.error || "").toLowerCase();
                    // If add failed due to duplicate/existing record, try Edit
                    if (errorStr.includes("duplicate") || errorStr.includes("already exists") || errorStr.includes("row having key")) {
                        console.log(`[AppSheet Manual Sync] Add failed (duplicate), retrying with Edit...`);
                        const editResult = await updateAppSheet(est, null, "Edit");
                        
                        if (!editResult.success) {
                            return NextResponse.json({ 
                                success: false, 
                                error: `Sync Failed. ADD Error: ${addResult.error}. EDIT Error: ${editResult.error}` 
                            });
                        }
                    } else {
                        // Some other error (e.g. validation, column missing)
                        return NextResponse.json({ success: false, error: addResult.error });
                    }
                }

                // Success
                await Estimate.findByIdAndUpdate(id, { syncedToAppSheet: true });
                return NextResponse.json({ success: true, message: 'Estimate synced to AppSheet successfully' });
            }

            case 'cloneEstimate': {
                const { id: sourceId } = payload || {};
                if (!sourceId) return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });

                // 1. Fetch Source Estimate
                const sourceEst = await Estimate.findById(sourceId).lean();
                if (!sourceEst) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // 2. Determine Next Version
                const allVersions = await Estimate.find({ estimate: sourceEst.estimate })
                    .select('versionNumber')
                    .lean();

                // Build a set of existing version numbers
                const existingVersions = new Set(allVersions.map((v: any) => v.versionNumber).filter(n => typeof n === 'number'));

                // Find the first missing number starting from 1
                let nextVersion = 1;
                while (existingVersions.has(nextVersion)) {
                    nextVersion++;
                }
                let newId = `${sourceEst.estimate}-V${nextVersion}`;

                // Collision Detection Loop: Ensure we don't hit a duplicate ID
                // (e.g. if version numbering got out of sync with IDs)
                while (await Estimate.exists({ _id: newId })) {
                    nextVersion++;
                    newId = `${sourceEst.estimate}-V${nextVersion}`;
                }

                // 3. Create New Estimate Document
                
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, createdAt, updatedAt, __v, ...sourceData } = sourceEst as any;

                const newEstData = {
                    ...sourceData,
                    _id: newId,
                    versionNumber: nextVersion,
                    status: 'pending',

                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const newEst = await Estimate.create(newEstData);

                // Sync to AppSheet - Clone is effectively an "Edit" to the same proposal number, or actually an "Add" if we consider versioning?
                // But AppSheet key is "estimate" (Proposal Number).
                // So if we clone 24-1000-V1 to 24-1000-V2, the key 24-1000 ALEADY EXISTS.
                // So this is an "Edit" in AppSheet terms.
                updateAppSheet(newEst, null, "Edit").catch(err => console.error('Clone sync error:', err));


                return NextResponse.json({ success: true, result: newEst });
            }

            case 'copyEstimate': {
                const { id: sourceId } = payload || {};
                if (!sourceId) return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });

                // 1. Fetch Source Estimate
                const sourceEst = await Estimate.findById(sourceId).lean();
                if (!sourceEst) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // 2. Generate New Estimate Number (Same logic as createEstimate)
                const currentYear = new Date().getFullYear();
                const yearSuffix = currentYear.toString().slice(-2);
                const startSeq = 1;

                const regex = new RegExp(`^${yearSuffix}-`);
                const existingEstimates = await Estimate.find({ estimate: { $regex: regex } })
                    .select('estimate')
                    .lean();

                const usedSequences = new Set<number>();
                existingEstimates.forEach((doc: any) => {
                    if (doc.estimate) {
                        const parts = doc.estimate.split('-');
                        if (parts.length === 2) {
                            const seq = parseInt(parts[1], 10);
                            if (!isNaN(seq)) {
                                usedSequences.add(seq);
                            }
                        }
                    }
                });

                let nextSeq = startSeq;
                while (usedSequences.has(nextSeq)) {
                    nextSeq++;
                }

                const estimateNumber = `${yearSuffix}-${String(nextSeq).padStart(4, '0')}`;

                // 3. Create New Estimate Document
                const newId = `${estimateNumber}-V1`;

                // Remove fields we don't want to copy or that need reset
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const {
                    _id, createdAt, updatedAt, __v,
                    estimate, proposalNo, versionNumber, date,
                    customerName, customerId,
                    contactName, contactId, contactEmail, contactPhone,
                    jobAddress,
                    status, ...sourceData
                } = sourceEst as any;

                const newEstData = {
                    ...sourceData,
                    _id: newId,
                    estimate: estimateNumber,
                    proposalNo: estimateNumber,
                    versionNumber: 1,
                    customerName: '',
                    customerId: '',
                    contactName: '',
                    contactId: '',
                    contactEmail: '',
                    contactPhone: '',
                    jobAddress: '',
                    status: 'pending',

                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const newEst = await Estimate.create(newEstData);

                // Sync to AppSheet - Copy creates NEW proposal number --> Add
                updateAppSheet(newEst, null, "Add").catch(err => console.error('Copy sync error:', err));


                return NextResponse.json({ success: true, result: newEst });
            }

            case 'createChangeOrder': {
                const { id: sourceId } = payload || {};
                if (!sourceId) return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });

                // 1. Fetch Source Version
                const sourceEst = await Estimate.findById(sourceId).lean();
                if (!sourceEst) return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });

                // 2. Determine Next Change Order Number for this version
                // IDs are formatted as Estimate-V[num]-CO[num]
                const regex = new RegExp(`^${sourceId}-CO([0-9]+)$`);
                const existingCOs = await Estimate.find({ _id: { $regex: regex } })
                    .select('_id')
                    .lean();

                let nextCO = 1;
                const usedCONumbers = existingCOs.map((co: any) => {
                    const match = co._id.match(regex);
                    return match ? parseInt(match[1], 10) : 0;
                });

                if (usedCONumbers.length > 0) {
                    nextCO = Math.max(...usedCONumbers) + 1;
                }

                const newId = `${sourceId}-CO${nextCO}`;

                // 3. Create New Change Order Document
                // copy ONLY header info, NOT line items or proposals as requested
                const { 
                    _id, createdAt, updatedAt, __v,
                    labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous,
                    proposals, proposal,
                    ...headerData 
                } = sourceEst as any;

                const newCOData = {
                    ...headerData,
                    _id: newId,
                    isChangeOrder: true,
                    parentVersionId: sourceId,
                    status: 'In Progress',
                    // Initialize empty arrays
                    labor: [],
                    equipment: [],
                    material: [],
                    tools: [],
                    overhead: [],
                    subcontractor: [],
                    disposal: [],
                    miscellaneous: [],
                    proposals: [],
                    
                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const newCO = await Estimate.create(newCOData);

                // Sync to AppSheet - This is a new record with a unique ID that still shares the Proposal Number
                // We'll treat it as an Add? Or Edit? 
                // AppSheet key is "Proposal Number" (estimate). If we want multiple COs in AppSheet, 
                // AppSheet might need a different key or we just overwrite the main one. 
                // Usually COs are separate records in AppSheet too.
                updateAppSheet(newCO, null, "Add").catch(err => console.error('CO sync error:', err));

                return NextResponse.json({ success: true, result: newCO });
            }

            case 'updateEstimate': {
                const { id: estId, ...updateData } = payload || {};
                if (!estId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                // Directly update the specific version document
                const updated = await Estimate.findByIdAndUpdate(
                    estId,
                    { ...updateData, updatedAt: new Date() },
                    { new: true }
                );
                
                // Log Activity
                if (updated) {
                    try {
                        const activityId = new Types.ObjectId().toString();
                        await Activity.create({
                            _id: activityId,
                            user: (() => {
                                const u = (updateData as any).proposalWriter || 
                                          (updateData as any).createdBy || 
                                          (payload as any).updatedBy || 
                                          updated?.proposalWriter || 
                                          'System';
                                return Array.isArray(u) ? u.join(', ') : String(u);
                            })(),
                            action: 'updated_estimate',
                            type: 'estimate',
                            title: `Updated Estimate #${updated.estimate}`,
                            entityId: updated.estimate, // Using estimate number for link construction if slug uses it
                            metadata: { estimate_id: updated._id },
                            createdAt: new Date()
                        });
                    } catch (e) {
                         console.error('Failed to log activity:', e);
                    }

                    // Sync to AppSheet if status changed
                    if (updateData.status) {
                        updateAppSheet(updated, null, "Edit").catch(err => console.error('Background AppSheet sync failed:', err));
                    }
                }

                if (updated && updated.estimate) {
                    // Fields that should be synced across ALL versions of this estimate
                    const SHARED_FIELDS = [
                        'projectName', 'jobAddress', 'contactAddress', 'customerId', 'customerName',
                        'contactName', 'contactEmail', 'contactPhone', 'contactId',
                        'accountingContact', 'accountingEmail', 'accountingPhone', 'PoORPa', 'poName', 'PoAddress', 'PoPhone',
                        'ocName', 'ocAddress', 'ocPhone',
                        'subCName', 'subCAddress', 'subCPhone',
                        'liName', 'liAddress', 'liPhone',
                        'scName', 'scAddress', 'scPhone',
                        'bondNumber', 'projectId', 'fbName', 'fbAddress', 'eCPRSystem',
                        'typeOfServiceRequired', 'wetUtilities', 'dryUtilities',
                        'projectDescription', 'estimatedStartDate', 'estimatedCompletionDate', 'siteConditions',
                        'prelimAmount', 'billingTerms', 'otherBillingTerms'
                    ];

                    // Construct update object for shared fields
                    const sharedUpdate: Record<string, any> = {};
                    let hasSharedUpdates = false;

                    SHARED_FIELDS.forEach(field => {
                        if (updateData[field] !== undefined) {
                            sharedUpdate[field] = updateData[field];
                            hasSharedUpdates = true;
                        }
                    });

                    // Propagate to all other versions if shared fields are present
                    if (hasSharedUpdates) {
                        try {
                            await Estimate.updateMany(
                                {
                                    estimate: updated.estimate, // Same Estimate Number
                                    _id: { $ne: updated._id }   // Exclude the one we just updated
                                },
                                {
                                    $set: {
                                        ...sharedUpdate,
                                        updatedAt: new Date()
                                    }
                                }
                            );
                            console.log(`Synced shared fields for Estimate #${updated.estimate} across versions.`);
                        } catch (syncErr) {
                            console.error('Failed to sync shared fields across versions:', syncErr);
                        }
                    }
                }

                // AppSheet Sync - Only if this is the LATEST version
                if (updated && updated.estimate) {
                     try {
                        const latestVer = await Estimate.find({ estimate: updated.estimate }).sort({ versionNumber: -1 }).limit(1).lean();
                        if (latestVer.length > 0 && String(latestVer[0]._id) === String(updated._id)) {
                             // This IS the latest version, so sync it
                             await updateAppSheet(updated.toObject(), null, "Edit");
                        }
                     } catch (e) {
                         console.error('AppSheet Update Sync Error:', e);
                     }
                }
                return NextResponse.json({ success: true, result: updated });
            }

            case 'syncToAppSheet': {
                const { id, mode } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const est = await Estimate.findById(id).lean();
                if (!est) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // Explicit Mode
                if (mode === 'Add') {
                    const result = await updateAppSheet(est, null, "Add");
                    return NextResponse.json(result);
                }
                if (mode === 'Edit') {
                    const result = await updateAppSheet(est, null, "Edit");
                    return NextResponse.json(result);
                }

                // Default "Smart" Mode (Edit -> Add Fallback)
                const result = await updateAppSheet(est, null, "Edit");
                
                if (!result.success && result.status === 404) {
                     console.log('Edit failed (404), trying Add...');
                     const addResult = await updateAppSheet(est, null, "Add");
                     return NextResponse.json(addResult);
                }

                if (!result.success) {
                    if (result.error && result.error.includes("not found")) {
                        const addResult = await updateAppSheet(est, null, "Add");
                        return NextResponse.json(addResult);
                    }
                }

                return NextResponse.json(result);
            }

            case 'deleteEstimate': {
                const { id: deleteId } = payload || {};
                if (!deleteId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                // 1. Fetch before delete to get info for sync & renumbering
                const estToDelete = await Estimate.findById(deleteId).lean() as any;
                if (!estToDelete) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                const estimateNumber = estToDelete.estimate;
                const isCO = estToDelete.isChangeOrder === true;
                const parentVersionId = estToDelete.parentVersionId;
                
                // 2. Delete the target version
                await Estimate.findByIdAndDelete(deleteId);
                
                // 3. Handle AppSheet Sync for Deletion
                if (estimateNumber) {
                     // Check if there are other versions left (temporarily, before renumbering)
                     const remaining = await Estimate.find({ estimate: estimateNumber }).sort({ versionNumber: -1 }).limit(1).lean();
                     
                     if (remaining.length === 0) {
                         // No versions left, truly DELETE from AppSheet
                         updateAppSheet(estToDelete, null, "Delete").catch(err => console.error('Delete sync error:', err));
                     }
                }

                if (isCO) {
                    // --- CASE A: Deleting a Change Order ---
                    // Renumber remaining COs for this specific parent version
                    const otherCOs = await Estimate.find({ 
                        parentVersionId, 
                        isChangeOrder: true 
                    }).sort({ createdAt: 1 }).lean();

                    for (let i = 0; i < otherCOs.length; i++) {
                        const doc = otherCOs[i];
                        const correctCONum = i + 1;
                        const expectedId = `${parentVersionId}-CO${correctCONum}`;

                        if (String(doc._id) !== expectedId) {
                            const oldId = String(doc._id);
                            const { _id, __v, ...data } = doc as any;
                            
                            // Re-create with new sequential ID
                            await Estimate.create({
                                ...data,
                                _id: expectedId,
                                updatedAt: new Date()
                            });
                            await Estimate.findByIdAndDelete(oldId);
                        }
                    }
                } else {
                    // --- CASE B: Deleting a Regular Version ---
                    // Shift subsequent versions down, and also update their child COs
                    const allVersions = await Estimate.find({ 
                        estimate: estimateNumber, 
                        isChangeOrder: { $ne: true } 
                    })
                    .sort({ versionNumber: 1 })
                    .lean();

                    for (let i = 0; i < allVersions.length; i++) {
                        const doc = allVersions[i];
                        const correctVerNum = i + 1;
                        const expectedId = `${estimateNumber}-V${correctVerNum}`;
                        
                        if (doc.versionNumber !== correctVerNum || String(doc._id) !== expectedId) {
                            const oldId = String(doc._id);
                            const { _id, __v, ...data } = doc as any;
                            
                            // 1. Move the regular version
                            await Estimate.create({
                                ...data,
                                _id: expectedId,
                                versionNumber: correctVerNum,
                                updatedAt: new Date()
                            });
                            await Estimate.findByIdAndDelete(oldId);

                            // 2. Find and update any COs linked to the OLD parent ID
                            const childCOs = await Estimate.find({ parentVersionId: oldId, isChangeOrder: true }).lean();
                            for (let j = 0; j < childCOs.length; j++) {
                                const coDoc = childCOs[j];
                                const coNumMatch = String(coDoc._id).match(/-CO(\d+)$/);
                                const coNum = coNumMatch ? coNumMatch[1] : (j + 1);
                                const newCOId = `${expectedId}-CO${coNum}`;

                                const { _id: coId, __v: coV, ...coData } = coDoc as any;
                                await Estimate.create({
                                    ...coData,
                                    _id: newCOId,
                                    parentVersionId: expectedId,
                                    updatedAt: new Date()
                                });
                                await Estimate.findByIdAndDelete(coId);
                            }
                        }
                    }
                }

                // 5. Final Sync Check
                // If we shifted versions, the "Latest" version might have a new ID/Version.
                // Sync the current latest to ensure AppSheet has the correct data for the "Estimate Number" key.
                const finalLatest = await Estimate.find({ estimate: estimateNumber })
                    .sort({ versionNumber: -1 })
                    .limit(1)
                    .lean();
                
                if (finalLatest.length > 0) {
                     // Sync this as an Edit (restoring the "Estimate" record to the content of the latest version)
                     updateAppSheet(finalLatest[0], null, "Edit").catch(err => console.error('Renumber-Sync error:', err));
                }

                return NextResponse.json({ success: true });
            }

            case 'importEstimates': {
                const { estimates } = payload || {};
                if (!Array.isArray(estimates)) return NextResponse.json({ success: false, error: 'Invalid estimates array' }, { status: 400 });

                // Fetch Employees for name resolution
                const allEmployees = await Employee.find({}).select('firstName lastName email _id').lean();

                // Helper to get value from multiple keys case-insensitive
                const getValue = (obj: any, keys: string[]) => {
                    for (const k of keys) {
                        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
                        // Try lowercase match too? Maybe risky for generic usage, stick to specific keys
                    }
                    return undefined;
                };

                // 1. Prepare Estimate Upsert Operations
                const estimateOps = estimates.map((e: any) => {
                    const identifier = e._id || e.Record_Id;
                    const estimateNum = e.estimate || e['Estimate #'];
                    if (!identifier && !estimateNum) return null;

                    // 1. Extract and sanitize versionNumber early for ID generation
                    const rawVersion = e.versionNumber || e['Version Number'] || e['Version'];
                    let vn = 1;
                    if (rawVersion) {
                        const parsed = parseInt(String(rawVersion).replace(/[^0-9]/g, ''));
                        if (!isNaN(parsed)) vn = parsed;
                    }

                    // Strip -V suffix if present in the estimate number to avoid double suffixing (e.g. 25-0636-V1-V1)
                    let baseEstNum = String(estimateNum);
                    const vMatch = baseEstNum.match(/-V(\d+)$/i);
                    if (vMatch) {
                        baseEstNum = baseEstNum.substring(0, vMatch.index);
                    }

                    const concatenatedId = `${baseEstNum}-V${vn}`;

                    const parseVal = (v: any) => {
                        if (typeof v === 'number') return v;
                        return parseFloat(String(v).replace(/[^0-9.-]+/g, "")) || 0;
                    };

                    const cleanData = { ...e };
                    
                    // Enhanced Field Mapping with Fallbacks
                    cleanData.estimate = baseEstNum; // Use cleaned number
                    
                    const custName = getValue(e, ['Customer', 'Customer Name', 'customerName', 'customer']);
                    if (custName) cleanData.customerName = custName;

                    if (e['Date']) cleanData.date = e['Date'];
                    if (e['Status']) cleanData.status = e['Status']?.toLowerCase();
                    
                    // Smart Proposal Writer Resolution
                    const writerInput = getValue(e, ['Proposal Writer', 'proposalWriter', 'Writer', 'proposal_writer']);
                    if (writerInput) {
                        const valStr = String(writerInput).trim();
                        if (valStr.includes('@')) {
                            // Already an email/ID
                            cleanData.proposalWriter = valStr;
                        } else {
                            // Lookup by name
                            const found = allEmployees.find((emp: any) => {
                                const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                                const firstOnly = (emp.firstName || '').toLowerCase();
                                return fullName === valStr.toLowerCase() || firstOnly === valStr.toLowerCase();
                            });
                            
                            if (found) {
                                cleanData.proposalWriter = found._id || found.email;
                            } else {
                                cleanData.proposalWriter = valStr; // Fallback to raw name
                            }
                        }
                    }

                    if (e['Fringe']) cleanData.fringe = e['Fringe'];
                    if (e['Certified Payroll']) cleanData.certifiedPayroll = e['Certified Payroll'];

                    // New Fields Mapping
                    if (e['Customer Job Number']) cleanData.customerJobNumber = e['Customer Job Number'];
                    if (e['Extension']) cleanData.extension = e['Extension'];
                    if (e['Accounting Contact']) cleanData.accountingContact = e['Accounting Contact'];
                    if (e['Accounting Email']) cleanData.accountingEmail = e['Accounting Email'];
                    if (e['PO OR PA']) cleanData.PoORPa = e['PO OR PA'];
                    if (e['PO Name']) cleanData.poName = e['PO Name'];
                    if (e['PO Address']) cleanData.PoAddress = e['PO Address'];
                    if (e['PO Phone']) cleanData.PoPhone = e['PO Phone'];
                    if (e['OC Name']) cleanData.ocName = e['OC Name'];
                    if (e['OC Address']) cleanData.ocAddress = e['OC Address'];
                    if (e['OC Phone']) cleanData.ocPhone = e['OC Phone'];
                    if (e['Sub C Name']) cleanData.subCName = e['Sub C Name'];
                    if (e['Sub C Address']) cleanData.subCAddress = e['Sub C Address'];
                    if (e['Sub C Phone']) cleanData.subCPhone = e['Sub C Phone'];
                    if (e['LI Name']) cleanData.liName = e['LI Name'];
                    if (e['LI Address']) cleanData.liAddress = e['LI Address'];
                    if (e['LI Phone']) cleanData.liPhone = e['LI Phone'];
                    if (e['SC Name']) cleanData.scName = e['SC Name'];
                    if (e['SC Address']) cleanData.scAddress = e['SC Address'];
                    if (e['SC Phone']) cleanData.scPhone = e['SC Phone'];
                    if (e['Bond Number']) cleanData.bondNumber = e['Bond Number'];
                    if (e['Project ID']) cleanData.projectId = e['Project ID'];
                    if (e['FB Name']) cleanData.fbName = e['FB Name'];
                    if (e['FB Address']) cleanData.fbAddress = e['FB Address'];
                    if (e['eCPR System']) cleanData.eCPRSystem = e['eCPR System'];
                    if (e['Type of Service Required']) cleanData.typeOfServiceRequired = e['Type of Service Required'];
                    if (e['Wet Utilities']) cleanData.wetUtilities = e['Wet Utilities'];
                    if (e['Dry Utilities']) cleanData.dryUtilities = e['Dry Utilities'];
                    if (e['Project Description']) cleanData.projectDescription = e['Project Description'];
                    if (e['Estimated Start Date']) cleanData.estimatedStartDate = e['Estimated Start Date'];
                    if (e['Estimated Completion Date']) cleanData.estimatedCompletionDate = e['Estimated Completion Date'];
                    if (e['Site Conditions']) cleanData.siteConditions = e['Site Conditions'];
                    if (e['Prelim Amount']) cleanData.prelimAmount = e['Prelim Amount'];
                    if (e['Billing Terms']) cleanData.billingTerms = e['Billing Terms'];
                    if (e['Other Billing Terms']) cleanData.otherBillingTerms = e['Other Billing Terms'];
                    
                    // Explicit mapping for camelCase or specific user-provided headers to ensure they are captured
                    if (e['accountingContact']) cleanData.accountingContact = e['accountingContact'];
                    if (e['accountingEmail']) cleanData.accountingEmail = e['accountingEmail'];
                    if (e['PoORPa']) cleanData.PoORPa = e['PoORPa'];
                    if (e['poName']) cleanData.poName = e['poName'];
                    if (e['PoAddress']) cleanData.PoAddress = e['PoAddress'];
                    if (e['PoPhone']) cleanData.PoPhone = e['PoPhone'];
                    if (e['ocName']) cleanData.ocName = e['ocName'];
                    if (e['ocAddress']) cleanData.ocAddress = e['ocAddress'];
                    if (e['ocPhone']) cleanData.ocPhone = e['ocPhone'];
                    if (e['subCName']) cleanData.subCName = e['subCName'];
                    if (e['subCAddress']) cleanData.subCAddress = e['subCAddress'];
                    if (e['subCPhone']) cleanData.subCPhone = e['subCPhone'];
                    if (e['liName']) cleanData.liName = e['liName'];
                    if (e['liAddress']) cleanData.liAddress = e['liAddress'];
                    if (e['liPhone']) cleanData.liPhone = e['liPhone'];
                    if (e['scName']) cleanData.scName = e['scName'];
                    if (e['scAddress']) cleanData.scAddress = e['scAddress'];
                    if (e['scPhone']) cleanData.scPhone = e['scPhone'];
                    if (e['bondNumber']) cleanData.bondNumber = e['bondNumber'];
                    if (e['projectId']) cleanData.projectId = e['projectId'];
                    if (e['fbName']) cleanData.fbName = e['fbName'];
                    if (e['fbAddress']) cleanData.fbAddress = e['fbAddress'];
                    if (e['eCPRSystem']) cleanData.eCPRSystem = e['eCPRSystem'];
                    if (e['typeOfServiceRequired']) cleanData.typeOfServiceRequired = e['typeOfServiceRequired'];
                    if (e['wetUtilities']) cleanData.wetUtilities = e['wetUtilities'];
                    if (e['dryUtilities']) cleanData.dryUtilities = e['dryUtilities'];
                    if (e['projectDescription']) cleanData.projectDescription = e['projectDescription'];
                    if (e['estimatedStartDate']) cleanData.estimatedStartDate = e['estimatedStartDate'];
                    if (e['estimatedCompletionDate']) cleanData.estimatedCompletionDate = e['estimatedCompletionDate'];
                    if (e['siteConditions']) cleanData.siteConditions = e['siteConditions'];
                    if (e['prelimAmount']) cleanData.prelimAmount = e['prelimAmount'];
                    if (e['billingTerms']) cleanData.billingTerms = e['billingTerms'];
                    if (e['otherBilling Terms']) cleanData.otherBillingTerms = e['otherBilling Terms'];

                    // Header Mapping for Totals
                    if (cleanData['Grand Total']) cleanData.grandTotal = cleanData['Grand Total'];
                    if (cleanData['Sub Total']) cleanData.subTotal = cleanData['Sub Total'];
                    if (cleanData['Margin']) cleanData.margin = cleanData['Margin'];

                    // Parse Numbers
                    if (cleanData.grandTotal !== undefined) cleanData.grandTotal = parseVal(cleanData.grandTotal);
                    if (cleanData.subTotal !== undefined) cleanData.subTotal = parseVal(cleanData.subTotal);
                    if (cleanData.margin !== undefined) cleanData.margin = parseVal(cleanData.margin);

                    // Ensure versionNumber is correct in cleanData
                    cleanData.versionNumber = vn;

                    // Prune empty fields logic was preventing updates if only some fields were passed?
                    // Actually, if cleanData has the correct new value, we should KEEP it.
                    // The issue might be that cleanData has OLD keys from the CSV specific check above?
                    // Wait, `cleanData` starts as `{...e}`. 
                    // If `e` has `Status: "Pending"`, then `cleanData.status` becomes "pending".
                    // If `e` DOES NOT have `status` key (only `Status`), `cleanData.status` is set correctly.
                    // BUT `cleanData` still has `Status` key. This is fine for Mongoose limit strict: false.

                    // Removing the prune logic that deletes fields if they are falsy.
                    // If the CSV has a blank value, maybe we WANT to blank it out?
                    // Or if our mapping logic failed, it might be undefined.
                    
                    // Let's NOT delete these for now to ensure whatever we mapped IS used.
                    // (Commented out pruning)
                    // if (!cleanData.status) delete cleanData.status;
                    // if (!cleanData.date) delete cleanData.date;
                    // if (!cleanData.customerName) delete cleanData.customerName;

                    // Remove explicit IDs to prevent immutable field error on update
                    delete cleanData._id;
                    delete cleanData.Record_Id;

                    const updateSet = { ...cleanData, updatedAt: new Date() };

                    // Ensure no overlap between $set and $setOnInsert
                    const setOnInsert: any = {
                        _id: concatenatedId,
                        createdAt: new Date(),
                        status: 'pending',
                        labor: [],
                        equipment: [],
                        material: [],
                        miscellaneous: [{
                            item: "Old",
                            quantity: 1,
                            cost: cleanData.grandTotal || 0,
                            unit: "Each",
                            total: cleanData.grandTotal || 0
                        }]
                    };

                    // Handle status/date/customer overlap
                    if (updateSet.status !== undefined) delete setOnInsert.status;
                    if (updateSet.date !== undefined) delete setOnInsert.date;
                    if (updateSet.customerName !== undefined) delete setOnInsert.customerName;

                    // Already have version in updateSet
                    delete setOnInsert.versionNumber;

                    const filter = { _id: concatenatedId };

                    return {
                        updateOne: {
                            filter: { _id: concatenatedId },
                            update: {
                                $set: updateSet,
                                $setOnInsert: setOnInsert
                            },
                            upsert: true
                        }
                    };
                }).filter(Boolean);

                // 2. Client Sync Logic (Contacts & Addresses) - Optimized
                // Use a Set to find unique customerIds involved in this import to avoid redundant lookups
                const customerIds = new Set(estimates.map((e: any) => e.customerId).filter(Boolean));

                // Fetch all relevant clients in one go
                // Fetch all relevant clients in one go and type as any to allow dynamic property addition
                const clients = await Client.find({ _id: { $in: Array.from(customerIds) } }).lean();
                // We use lean() to get POJOs that we can easily mutate, though we lose save() which we aren't using (we use bulkWrite)
                const clientMap = new Map(clients.map((c: any) => [String(c._id), c]));

                // Prepare bulk updates for Clients
                const clientUpdates: any[] = [];

                for (const e of estimates) {
                    if (!e.customerId) continue;

                    const client: any = clientMap.get(String(e.customerId));
                    if (!client) continue;

                    let updated = false;
                    // Initialize updates object for this client if not already processing
                    // Note: To truly bulk update clients safely if multiple rows affect the same client, 
                    // we would need more complex logic. For simplicity and correctness with potentially multiple rows per client
                    // we will still process update logic per row but collect operations.
                    // However, MongoDB bulkWrite for same document with $push might conflict or create race conditions if not careful.
                    // A safer simple optimizations is to just run them in parallel with a concurrency limit or just Promise.all
                    // But since we need to read state (is contact existing?), we really should process serially per client or update our in-memory client state.

                    if (!client._updatedInMemory) {
                        client._updatedInMemory = true; // markers for our logic
                        client.activeUpdates = { $push: {} };
                    }

                    // Helper to check in-memory state (original + pending updates)
                    const currentContacts = [...(client.contacts || []), ...(client.activeUpdates?.$push?.contacts || [])];
                    const currentAddresses = [...(client.addresses || []), ...(client.activeUpdates?.$push?.addresses || [])]; // addresses is array of strings

                    // Check Contact
                    const contactExists = currentContacts.some((c: any) =>
                        (e.contactId && c._id === e.contactId) ||
                        (c.email && c.email === e.contactEmail) ||
                        (c.name === e.contactName)
                    );

                    if (!contactExists && (e.contactName || e.contactEmail)) {
                        if (!client.activeUpdates.$push.contacts) client.activeUpdates.$push.contacts = [];
                        client.activeUpdates.$push.contacts.push({
                            name: e.contactName || 'Unknown',
                            email: e.contactEmail,
                            phone: e.contactPhone,
                            extension: e.extension || e['Extension'],
                            type: 'Main Contact',
                            active: currentContacts.length === 0
                        });
                        updated = true;
                    }

                    // Check Accounting Contact
                    const accName = e.accountingContact || e['Accounting Contact'];
                    const accEmail = e.accountingEmail || e['Accounting Email'];

                    if (accName || accEmail) {
                        const accountingExists = currentContacts.some((c: any) =>
                            c.type === 'Accounting' && (
                                (accEmail && c.email === accEmail) ||
                                (accName && c.name === accName)
                            )
                        );

                        if (!accountingExists) {
                            if (!client.activeUpdates.$push.contacts) client.activeUpdates.$push.contacts = [];
                            client.activeUpdates.$push.contacts.push({
                                name: accName || 'Accounting Contact',
                                email: accEmail || '',
                                phone: '', // Accounting contact usually has no phone in this context
                                type: 'Accounting',
                                active: false
                            });
                            updated = true;
                        }
                    }

                    // Check Address
                    const addressExists = currentAddresses.includes(e.jobAddress);
                    if (!addressExists && e.jobAddress) {
                        if (!client.activeUpdates.$push.addresses) client.activeUpdates.$push.addresses = [];
                        if (Array.isArray(client.activeUpdates.$push.addresses)) {
                            client.activeUpdates.$push.addresses.push(e.jobAddress);
                        } else {
                            // Should be an array based on initialization above but typescript safety
                            client.activeUpdates.$push.addresses = [e.jobAddress];
                        }
                        updated = true;
                    }
                }

                // Execute Client Updates
                const clientBulkOps = Array.from(clientMap.values())
                    .filter((c: any) => c.activeUpdates && (c.activeUpdates.$push?.contacts?.length || c.activeUpdates.$push?.addresses?.length))
                    .map((c: any) => ({
                        updateOne: {
                            filter: { _id: c._id },
                            update: {
                                $push: {
                                    ...(c.activeUpdates.$push.contacts?.length ? { contacts: { $each: c.activeUpdates.$push.contacts } } : {}),
                                    ...(c.activeUpdates.$push.addresses?.length ? { addresses: { $each: c.activeUpdates.$push.addresses } } : {})
                                }
                            }
                        }
                    }));

                if (clientBulkOps.length > 0) {
                    await Client.bulkWrite(clientBulkOps);
                }

                if (estimateOps.length === 0) return NextResponse.json({ success: false, error: 'No valid records to import' });

                const result = await Estimate.bulkWrite(estimateOps as any);
                return NextResponse.json({ success: true, result });
            }



            // ========== CATALOGUE ==========
            case 'getCatalogueItems': {
                const { type } = payload || {};
                if (!type) return NextResponse.json({ success: false, error: 'Missing type' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const items = await Model.find().sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: items });
            }

            case 'getAllCatalogueItems': {
                const [
                    equipment,
                    labor,
                    material,
                    overhead,
                    subcontractor,
                    disposal,
                    miscellaneous,
                    tools,
                    constants
                ] = await Promise.all([
                    EquipmentItem.find().sort({ createdAt: -1 }).lean(),
                    LaborItem.find().sort({ createdAt: -1 }).lean(),
                    MaterialItem.find().sort({ createdAt: -1 }).lean(),
                    OverheadItem.find().sort({ createdAt: -1 }).lean(),
                    SubcontractorItem.find().sort({ createdAt: -1 }).lean(),
                    DisposalItem.find().sort({ createdAt: -1 }).lean(),
                    MiscellaneousItem.find().sort({ createdAt: -1 }).lean(),
                    ToolItem.find().sort({ createdAt: -1 }).lean(),
                    Constant.find().sort({ createdAt: -1 }).lean()
                ]);

                return NextResponse.json({
                    success: true,
                    result: {
                        equipment,
                        labor,
                        material,
                        overhead,
                        subcontractor,
                        disposal,
                        miscellaneous,
                        tools,
                        constant: constants
                    }
                });
            }

            case 'getCatalogueCounts': {
                const [
                    equipment,
                    labor,
                    material,
                    overhead,
                    subcontractor,
                    disposal,
                    miscellaneous,
                    tools,
                    constants
                ] = await Promise.all([
                    EquipmentItem.countDocuments(),
                    LaborItem.countDocuments(),
                    MaterialItem.countDocuments(),
                    OverheadItem.countDocuments(),
                    SubcontractorItem.countDocuments(),
                    DisposalItem.countDocuments(),
                    MiscellaneousItem.countDocuments(),
                    ToolItem.countDocuments(),
                    Constant.countDocuments()
                ]);

                return NextResponse.json({
                    success: true,
                    result: {
                        equipment,
                        labor,
                        material,
                        overhead,
                        subcontractor,
                        disposal,
                        miscellaneous,
                        tools,
                        constant: constants
                    }
                });
            }

            case 'addCatalogueItem': {
                const { type, item } = payload || {};
                if (!type || !item) return NextResponse.json({ success: false, error: 'Missing type or item' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const newItem = await Model.create(item);
                return NextResponse.json({ success: true, result: newItem });
            }

            case 'updateCatalogueItem': {
                const { type, id: catId, item } = payload || {};
                if (!type || !catId) return NextResponse.json({ success: false, error: 'Missing type or id' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const updated = await Model.findByIdAndUpdate(catId, { ...item, updatedAt: new Date() }, { new: true }).lean();
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteCatalogueItem': {
                const { type, id: catDelId } = payload || {};
                if (!type || !catDelId) return NextResponse.json({ success: false, error: 'Missing type or id' }, { status: 400 });

                const Model = getCatalogueModel(type);
                if (!Model) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                await Model.findByIdAndDelete(catDelId);
                return NextResponse.json({ success: true });
            }

            // ========== LINE ITEMS ==========
            /*
            // Line items are now handled directly within updateEstimate
            // Keeping these cases as comments or removing entirely if confirmed dead
            case 'addLineItem':
            case 'updateLineItem':
            case 'deleteLineItem':
                return NextResponse.json({ success: false, error: 'Deprecated endpoint. Use updateEstimate.' }, { status: 410 });
            */

            // ========== CONSTANTS ==========
            case 'getConstants': {
                const items = await Constant.find().sort({ createdAt: -1 });
                return NextResponse.json({ success: true, result: items });
            }

            case 'addConstant': {
                const item = payload?.item || {};

                // Handle Image Upload
                if (item.image && item.image.startsWith('data:image')) {
                    const uploaded = await uploadImage(item.image, `constant_${Date.now()}`);
                    if (uploaded) item.image = uploaded;
                }

                const newConst = await Constant.create(item);
                return NextResponse.json({ success: true, result: newConst });
            }

            case 'updateConstant': {
                const { id: constId, item: constItem } = payload || {};
                if (!constId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                let updateData = { ...constItem };

                // Handle Image Upload
                if (updateData.image && updateData.image.startsWith('data:image')) {
                    const uploaded = await uploadImage(updateData.image, `constant_${constId}_${Date.now()}`);
                    if (uploaded) updateData.image = uploaded;
                }

                const updated = await Constant.findByIdAndUpdate(constId, { ...updateData, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteConstant': {
                const { id: constDelId } = payload || {};
                if (!constDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                await Constant.findByIdAndDelete(constDelId);
                return NextResponse.json({ success: true });
            }


            // ========== CLIENTS ==========
            case 'getClients': {
                const clients = await Client.find().sort({ name: 1 });
                return NextResponse.json({ success: true, result: clients });
            }

            case 'addClient': {
                const { item } = payload || {};
                if (!item) return NextResponse.json({ success: false, error: 'Missing client data' }, { status: 400 });

                const contacts: any[] = [];
                const inputContacts = Array.isArray(item.contacts) ? item.contacts : [];

                inputContacts.forEach((con: any, idx: number) => {
                    contacts.push({
                        ...con,
                        type: con.type || 'Main Contact',
                        active: con.active !== undefined ? con.active : (idx === 0),
                        primary: con.primary !== undefined ? con.primary : (idx === 0)
                    });
                });

                // Migrate legacy main contact info
                if (item.contactFullName || item.email || item.phone) {
                    const exists = contacts.some(con => con.name === item.contactFullName);
                    if (!exists) {
                        contacts.push({
                            name: item.contactFullName || 'Primary Contact',
                            email: item.email || '',
                            phone: item.phone || '',
                            type: 'Main Contact',
                            active: contacts.length === 0,
                            primary: contacts.length === 0
                        });
                    }
                }

                // Migrate legacy accounting info
                if (item.accountingContact || item.accountingEmail) {
                    const exists = contacts.some(con => con.name === item.accountingContact && con.type === 'Accounting');
                    if (!exists) {
                        contacts.push({
                            name: item.accountingContact || 'Accounting Contact',
                            email: item.accountingEmail || '',
                            type: 'Accounting',
                            active: contacts.length === 0,
                            primary: false
                        });
                    }
                }

                // Ensure exactly one is active AND one is primary
                if (contacts.length > 0) {
                    if (!contacts.some(con => con.active)) contacts[0].active = true;
                    if (!contacts.some(con => con.primary)) contacts[0].primary = true;
                }

                // Handle addresses
                let addresses = Array.isArray(item.addresses) ? item.addresses : [];
                addresses = addresses.map((addr: any, idx: number) => {
                    if (typeof addr === 'string') {
                        return { address: addr, primary: idx === 0 };
                    }
                    return addr;
                });

                // Sync businessAddress with primary address
                const primaryAddr = addresses.find((a: any) => a.primary) || addresses[0];
                const businessAddress = primaryAddr ? (typeof primaryAddr === 'string' ? primaryAddr : primaryAddr.address) : item.businessAddress || '';

                const clientData = {
                    ...item,
                    contacts,
                    addresses,
                    businessAddress,
                    _id: item.recordId || item._id || `C-${Date.now()}`
                };
                delete (clientData as any).accountingContact;
                delete (clientData as any).accountingEmail;
                delete (clientData as any).contactFullName;
                delete (clientData as any).email;
                delete (clientData as any).phone;

                const newClient = await Client.create(clientData);
                // Sync to AppSheet
                updateAppSheetClient(newClient, "Add").catch(err => console.error('AppSheet Client Sync Error:', err));

                return NextResponse.json({ success: true, result: newClient });
            }

            case 'updateClient': {
                try {
                    const { id: clientId, item: clientItem } = payload || {};
                    if (!clientId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                    // Handle contact refactoring and migration
                    if (clientItem.accountingContact || clientItem.accountingEmail || clientItem.contactFullName || clientItem.email || clientItem.phone || Array.isArray(clientItem.contacts)) {
                        const contacts = Array.isArray(clientItem.contacts) ? [...clientItem.contacts] : [];

                        // Migrate/Update primary contact info if provided as top-level
                        if (clientItem.contactFullName || clientItem.email || clientItem.phone) {
                            const mainIdx = contacts.findIndex(con => (con.type === 'Main Contact' && con.active) || con.name === clientItem.contactFullName);
                            if (mainIdx > -1) {
                                contacts[mainIdx] = {
                                    ...contacts[mainIdx],
                                    name: clientItem.contactFullName || contacts[mainIdx].name,
                                    email: clientItem.email || contacts[mainIdx].email,
                                    phone: clientItem.phone || contacts[mainIdx].phone
                                };
                            } else {
                                contacts.push({
                                    name: clientItem.contactFullName || 'Main Contact',
                                    email: clientItem.email || '',
                                    phone: clientItem.phone || '',
                                    type: 'Main Contact',
                                    active: contacts.length === 0,
                                    primary: contacts.length === 0
                                });
                            }
                        }

                        // Migrate/Update accounting contact info if provided as top-level
                        if (clientItem.accountingContact || clientItem.accountingEmail) {
                            const accIdx = contacts.findIndex(con => con.type === 'Accounting');
                            if (accIdx > -1) {
                                contacts[accIdx] = {
                                    ...contacts[accIdx],
                                    name: clientItem.accountingContact || contacts[accIdx].name,
                                    email: clientItem.accountingEmail || contacts[accIdx].email
                                };
                            } else {
                                contacts.push({
                                    name: clientItem.accountingContact || 'Accounting',
                                    email: clientItem.accountingEmail || '',
                                    type: 'Accounting',
                                    active: contacts.length === 0,
                                    primary: false
                                });
                            }
                        }

                        // Clean up legacy fields from update object
                        delete (clientItem as any).accountingContact;
                        delete (clientItem as any).accountingEmail;
                        delete (clientItem as any).contactFullName;
                        delete (clientItem as any).email;
                        delete (clientItem as any).phone;

                        // Ensure all contacts have type, active, and primary status
                        const processedContacts = contacts.map((con, idx) => ({
                            ...con,
                            type: con.type || 'Main Contact',
                            active: con.active !== undefined ? con.active : (idx === 0),
                            primary: con.primary !== undefined ? con.primary : (idx === 0)
                        }));

                        // Ensure exactly one is active and exactly one is primary
                        if (processedContacts.length > 0) {
                            if (!processedContacts.some(con => con.active)) processedContacts[0].active = true;
                            if (!processedContacts.some(con => con.primary)) processedContacts[0].primary = true;
                        }

                        clientItem.contacts = processedContacts;
                    }

                    // Handle addresses refactoring and migration
                    if (Array.isArray(clientItem.addresses)) {
                        clientItem.addresses = clientItem.addresses.map((addr: any, idx: number) => {
                            if (typeof addr === 'string') {
                                return { address: addr, primary: idx === 0 };
                            }
                            return addr;
                        });

                        // Ensure exactly one is primary
                        if (clientItem.addresses.length > 0 && !clientItem.addresses.some((a: any) => a.primary)) {
                            clientItem.addresses[0].primary = true;
                        }

                        // Sync businessAddress with primary address
                        const primaryAddr = clientItem.addresses.find((a: any) => a.primary) || clientItem.addresses[0];
                        if (primaryAddr) {
                            clientItem.businessAddress = primaryAddr.address;
                        }
                    }

                    const updated = await Client.findByIdAndUpdate(
                        clientId,
                        { ...clientItem, updatedAt: new Date() },
                        { new: true, strict: false }
                    );

                    // If the client name was updated, sync it to all related estimates and schedules
                    if (clientItem.name && updated) {
                        await Promise.all([
                            Estimate.updateMany(
                                { customerId: clientId },
                                { $set: { customerName: clientItem.name } }
                            ),
                            Schedule.updateMany(
                                { customerId: clientId },
                                { $set: { customerName: clientItem.name } }
                            )
                        ]);
                    }

                    // Sync to AppSheet
                    if (updated) {
                         updateAppSheetClient(updated, "Edit").catch(err => console.error('AppSheet Client Sync Error:', err));
                    }

                    return NextResponse.json({ success: true, result: updated });
                } catch (err: any) {
                    console.error('[API] updateClient Error:', err);
                    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
                }
            }

            case 'deleteClient': {
                const { id: clientDelId } = payload || {};
                if (!clientDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Client.findByIdAndDelete(clientDelId);
                // Sync to AppSheet
                updateAppSheetClient({ _id: clientDelId }, "Delete").catch(err => console.error('AppSheet Client Sync Error:', err));

                return NextResponse.json({ success: true });
            }

            case 'importClients': {
                const { clients: importClientsArray } = payload || {};
                if (!Array.isArray(importClientsArray)) return NextResponse.json({ success: false, error: 'Invalid clients array' }, { status: 400 });

                const operations = importClientsArray.map((client: any) => {
                    const contacts: any[] = [];
                    if (Array.isArray(client.contacts)) {
                        client.contacts.forEach((con: any, idx: number) => {
                            contacts.push({
                                ...con,
                                type: con.type || 'Main Contact',
                                active: con.active !== undefined ? con.active : (idx === 0)
                            });
                        });
                    }

                    // Map legacy main contact info to contacts array
                    if (client.contactFullName || client.email || client.phone) {
                        const exists = contacts.some(con => con.name === client.contactFullName);
                        if (!exists) {
                            contacts.push({
                                name: client.contactFullName || 'Primary Contact',
                                email: client.email || '',
                                phone: client.phone || '',
                                extension: client.extension || client.Extension || client.Ext || '',
                                type: 'Main Contact',
                                active: contacts.length === 0
                            });
                        }
                    }

                    // Map legacy accounting info
                    if (client.accountingContact || client.accountingEmail) {
                        const exists = contacts.some(con => con.name === client.accountingContact && con.type === 'Accounting');
                        if (!exists) {
                            contacts.push({
                                name: client.accountingContact || 'Accounting Contact',
                                email: client.accountingEmail || '',
                                type: 'Accounting',
                                active: contacts.length === 0
                            });
                        }
                    }

                    // Final check: ensure at least one active
                    if (contacts.length > 0 && !contacts.some(con => con.active)) {
                        contacts[0].active = true;
                    }

                    const updateData: any = {
                        ...client,
                        _id: client.recordId || client._id,
                        contacts,
                        updatedAt: new Date()
                    };
                    delete updateData.accountingContact;
                    delete updateData.accountingEmail;
                    delete updateData.contactFullName;
                    delete updateData.email;
                    delete updateData.phone;
                    delete updateData.extension;

                    // Map legacy single address to addresses array if not already present
                    if (client.businessAddress && (!client.addresses || client.addresses.length === 0)) {
                        updateData.addresses = [{ address: client.businessAddress, primary: true }];
                    } else if (Array.isArray(client.addresses)) {
                        updateData.addresses = client.addresses.map((addr: any, idx: number) => {
                            if (typeof addr === 'string') {
                                return { address: addr, primary: idx === 0 };
                            }
                            return addr;
                        });
                    }

                    // Final check for addresses primary
                    if (Array.isArray(updateData.addresses) && updateData.addresses.length > 0) {
                        if (!updateData.addresses.some((a: any) => a.primary)) {
                            updateData.addresses[0].primary = true;
                        }
                        // Sync businessAddress
                        const primaryAddr = updateData.addresses.find((a: any) => a.primary);
                        if (primaryAddr) updateData.businessAddress = primaryAddr.address;
                    }

                    return {
                        updateOne: {
                            filter: { _id: client.recordId || client._id },
                            update: {
                                $set: updateData,
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                const result = await Client.bulkWrite(operations);
                return NextResponse.json({ success: true, result });
            }

            case 'uploadDocument': {
                const { file, fileName, contentType } = payload || {};
                if (!file) return NextResponse.json({ success: false, error: 'Missing file data' }, { status: 400 });
                const url = await uploadToR2(file, fileName || `doc_${Date.now()}`, contentType || 'application/octet-stream');
                return NextResponse.json({ success: true, result: url });
            }

            case 'uploadThumbnail': {
                const { file, fileName, contentType } = payload || {};
                if (!file) return NextResponse.json({ success: false, error: 'Missing file data' }, { status: 400 });
                const url = await uploadThumbnail(file, fileName || `thumb_${Date.now()}`, contentType || 'image/png');
                return NextResponse.json({ success: true, result: url });
            }

            case 'uploadRawToCloudinary': {
                const { file, fileName, contentType } = payload || {};
                if (!file) return NextResponse.json({ success: false, error: 'Missing file data' }, { status: 400 });
                const result = await uploadRawToCloudinary(file, fileName || `contract_${Date.now()}`, contentType || 'application/octet-stream');
                return NextResponse.json({ success: !!result, result });
            }

            case 'deleteCloudinaryFiles': {
                const { urls } = payload || {};
                if (!urls || !Array.isArray(urls)) return NextResponse.json({ success: false, error: 'Missing urls' }, { status: 400 });
                
                for (const url of urls) {
                    await deleteFromCloudinary(url);
                }
                return NextResponse.json({ success: true });
            }

            case 'deleteDocumentFiles': {
                const { url, thumbnailUrl } = payload || {};
                if (url) {
                    let r2Key = '';
                    if (url.includes('/api/docs/')) {
                        r2Key = url.split('/api/docs/')[1].split('?')[0];
                    } else if (url.includes('.cloudflarestorage.com/')) {
                        r2Key = url.split('.cloudflarestorage.com/')[1];
                    }
                    if (r2Key) {
                        r2Key = decodeURIComponent(r2Key);
                        await removeFromR2(r2Key);
                    }
                }
                if (thumbnailUrl) await deleteFromCloudinary(thumbnailUrl);
                return NextResponse.json({ success: true });
            }

            case 'getClientById': {
                const { id: clientId } = payload || {};
                if (!clientId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const client = await Client.findById(clientId);
                if (!client) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: client });
            }

            case 'getTemplates': {
                const items = await Template.find().sort({ createdAt: -1 });
                return NextResponse.json({ success: true, result: items });
            }

            case 'addTemplate': {
                const item = payload?.item || {};
                const services = normalizeServices(item.services);
                
                const conflict = await checkTemplateServicesConflict(services);
                if (conflict) {
                    return NextResponse.json({ 
                        success: false, 
                        error: `Service conflict: The template "${(conflict as any).title}" already uses this exact set of services.` 
                    }, { status: 200 }); // Return 200 to avoid red console errors, UI handles success: false
                }

                const newTemplate = await Template.create({ ...item, services });
                return NextResponse.json({ success: true, result: newTemplate });
            }

            case 'updateTemplate': {
                const { id: tempId, item: tempItem } = payload || {};
                if (!tempId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                
                if (tempItem.services) {
                    const services = normalizeServices(tempItem.services);
                    const conflict = await checkTemplateServicesConflict(services, tempId);
                    if (conflict) {
                        return NextResponse.json({ 
                            success: false, 
                            error: `Service conflict: The template "${(conflict as any).title}" already uses this exact set of services.` 
                        }, { status: 200 }); // Return 200 to avoid red console errors
                    }
                    tempItem.services = services;
                }

                const updated = await Template.findByIdAndUpdate(tempId, { ...tempItem, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteTemplate': {
                const { id: tempDelId } = payload || {};
                if (!tempDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Template.findByIdAndDelete(tempDelId);
                return NextResponse.json({ success: true });
            }

            case 'cloneTemplate': {
                const { id: cloneId } = payload || {};
                if (!cloneId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const original = await Template.findById(cloneId).lean();
                if (!original) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                const { _id, createdAt, updatedAt, ...rest } = original as any;
                
                // When cloning, we clear services to avoid immediate uniqueness conflict
                const newTemplate = await Template.create({
                    ...rest,
                    title: `${rest.title} (Copy)`,
                    services: [], // Clear services as per uniqueness rule
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return NextResponse.json({ success: true, result: newTemplate });
            }

            case 'getGlobalCustomVariables': {
                const vars = await GlobalCustomVariable.find().sort({ createdAt: 1 });
                return NextResponse.json({ success: true, result: vars });
            }

            case 'saveGlobalCustomVariables': {
                const { variables } = payload || {};
                if (!Array.isArray(variables)) return NextResponse.json({ success: false, error: 'Invalid variables array' }, { status: 400 });
                await GlobalCustomVariable.deleteMany({});
                if (variables.length > 0) await GlobalCustomVariable.insertMany(variables);
                const updated = await GlobalCustomVariable.find().sort({ createdAt: 1 });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'previewProposal': {
                const { templateId, estimateId, editMode = true, estimateData, pages } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });
                let template;
                if (templateId === 'empty') {
                    template = getEmptyTemplate();
                } else if (templateId === 'custom') {
                    // If previewing a custom proposal that isn't saved as a template
                    const dbEstimate = await Estimate.findById(estimateId).lean() as any;
                    const proposal = dbEstimate?.proposals?.find((p: any) => p.templateId === 'custom') || dbEstimate?.proposal;
                    if (proposal) {
                        template = {
                            _id: 'custom',
                            pages: proposal.customPages || [],
                            content: proposal.htmlContent || ''
                        };
                    } else {
                        template = getEmptyTemplate();
                    }
                } else {
                    template = await Template.findById(templateId).lean();
                }
                const dbEstimate = await Estimate.findById(estimateId).lean();

                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!dbEstimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });
                let estimate = estimateData ? { ...dbEstimate, ...estimateData } : dbEstimate;
                
                // FORCE: contactAddress to be Client's Primary Address
                estimate = await enrichEstimate(estimate);

                // Resolve with custom pages if provided (to reflect manual edits in preview)
                const currentTemplate = pages ? { ...template, pages } : template;
                const html = resolveTemplateDocument(currentTemplate, estimate as any, editMode);
                return NextResponse.json({ success: true, result: { html } });
            }

            case 'generateProposal': {
                const { templateId, estimateId, customVariables = {}, estimateData = null } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });
                let template;
                if (templateId === 'empty') {
                    template = getEmptyTemplate();
                } else {
                    template = await Template.findById(templateId).lean();
                }
                const estimate = await Estimate.findById(estimateId);

                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!estimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // If estimateData is provided (unsaved changes from frontend), apply them
                if (estimateData) {
                    Object.keys(estimateData).forEach(key => {
                        if (!['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
                            (estimate as any)[key] = estimateData[key];
                        }
                    });
                }

                (estimate as any).customVariables = customVariables;
                estimate.markModified('customVariables');
                const estimateObj = estimate.toObject() as any;
                estimateObj.customVariables = customVariables;
                
                // FORCE: contactAddress to be Client's Primary Address
                await enrichEstimate(estimateObj);

                const html = resolveTemplateDocument(template, estimateObj, false);
                
                const proposalData = {
                    templateId: templateId === 'empty' ? 'empty' : String(template._id),
                    templateVersion: template.version || 1,
                    generatedAt: new Date(),
                    htmlContent: html,
                    pdfUrl: '',
                    customPages: template.pages || [],
                    services: estimateData?.services || estimate.services || []
                };
                
                // Removed legacy singular proposal/templateId updates in favor of proposals array
                
                // Also save to proposals array - ALWAYS push new for version history
                const proposals = (estimate as any).proposals || [];
                
                // Add unique ID for the new proposal version
                (proposalData as any)._id = new Types.ObjectId();
                
                // Push new version
                proposals.push(proposalData as any);
                
                (estimate as any).proposals = proposals;
                estimate.markModified('proposals');
                
                await estimate.save();
                return NextResponse.json({ success: true, result: { html } });
            }

            // Save proposal from custom pages WITHOUT updating the main template
            case 'generateProposalFromPages': {
                const { templateId, estimateId, pages, estimateData = null } = payload || {};
                if (!estimateId) return NextResponse.json({ success: false, error: 'Missing estimateId' }, { status: 400 });
                if (!pages || !Array.isArray(pages)) return NextResponse.json({ success: false, error: 'Missing or invalid pages' }, { status: 400 });
                
                const estimate = await Estimate.findById(estimateId);
                if (!estimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // If estimateData is provided (unsaved changes from frontend), apply them
                if (estimateData) {
                    Object.keys(estimateData).forEach(key => {
                        if (!['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
                            (estimate as any)[key] = estimateData[key];
                        }
                    });
                }

                // Build a temporary template object using the provided pages (NOT updating the real template)
                const tempTemplate = {
                    _id: templateId || 'custom',
                    pages: pages,
                    content: pages[0]?.content || ''
                };

                const estimateObj = estimate.toObject() as any;
                
                // FORCE: contactAddress to be Client's Primary Address
                await enrichEstimate(estimateObj);

                const html = resolveTemplateDocument(tempTemplate, estimateObj, false);
                
                const proposalData = {
                    templateId: templateId ? String(templateId) : 'custom',
                    templateVersion: 0, // Custom version - not from template
                    generatedAt: new Date(),
                    htmlContent: html,
                    pdfUrl: '',
                    customPages: pages, // Store the custom pages for future editing
                    services: estimateData?.services || estimate.services || []
                };
                
                // Save to proposals array - ALWAYS push new for version history
                const proposals = (estimate as any).proposals || [];
                
                // Add unique ID for the new proposal version
                (proposalData as any)._id = new Types.ObjectId();
                
                // Push new version
                proposals.push(proposalData);
                
                // Removed legacy singular proposal/templateId updates

                (estimate as any).proposals = proposals;
                estimate.markModified('proposals');
                
                await estimate.save();
                
                // Return the FULL proposal object so frontend can grab the new ID
                return NextResponse.json({ success: true, result: proposalData });
            }

            case 'getEmployees': {
                const employees = await Employee.find().sort({ name: 1 });
                return NextResponse.json({ success: true, result: employees });
            }

            case 'getEmployeeById': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const employee = await Employee.findById(id);
                return NextResponse.json({ success: true, result: employee });
            }

            case 'addEmployee': {
                const { item } = payload || {};
                if (!item || !item.email) return NextResponse.json({ success: false, error: 'Missing employee data or email' }, { status: 400 });
                let profilePictureUrl = item.profilePicture;
                if (item.profilePicture && item.profilePicture.startsWith('data:image')) {
                    const uploaded = await uploadImage(item.profilePicture, item.email);
                    if (uploaded) profilePictureUrl = uploaded;
                }
                const employeeData = { ...item, _id: item.email, profilePicture: profilePictureUrl };
                const newEmployee = await Employee.create(employeeData);
                return NextResponse.json({ success: true, result: newEmployee });
            }

            case 'updateEmployee': {
                const { id: empId, item: empItem } = payload || {};
                if (!empId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                let updateData = { ...empItem };
                if (empItem.profilePicture && empItem.profilePicture.startsWith('data:image')) {
                    const uploaded = await uploadImage(empItem.profilePicture, empId);
                    if (uploaded) updateData.profilePicture = uploaded;
                }
                const updated = await Employee.findByIdAndUpdate(empId, { ...updateData, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteEmployee': {
                const { id: empDelId } = payload || {};
                if (!empDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Employee.findByIdAndDelete(empDelId);
                return NextResponse.json({ success: true });
            }

            case 'importEmployees': {
                const { employees } = payload || {};
                if (!Array.isArray(employees)) return NextResponse.json({ success: false, error: 'Invalid employees array' }, { status: 400 });
                const operations = employees.map((e: any) => {
                    if (!e.email) return null;
                    let scheduleActive = e.isScheduleActive;
                    if (typeof scheduleActive === 'string') {
                        const val = scheduleActive.trim().toUpperCase();
                        scheduleActive = ['YES', 'Y', 'TRUE', '1'].includes(val);
                    }
                    const rateSite = e.hourlyRateSITE ? parseNum(e.hourlyRateSITE) : 0;
                    const rateDrive = e.hourlyRateDrive ? parseNum(e.hourlyRateDrive) : 0;
                    const { _id, isScheduleActive, hourlyRateSITE, hourlyRateDrive, ...rest } = e;
                    const finalUpdate = { ...rest, isScheduleActive: scheduleActive, hourlyRateSITE: rateSite, hourlyRateDrive: rateDrive, email: e.email, updatedAt: new Date() };
                    return {
                        updateOne: {
                            filter: { _id: e.email },
                            update: { $set: finalUpdate, $setOnInsert: { _id: e.email, createdAt: new Date() } },
                            upsert: true
                        }
                    };
                }).filter(Boolean);
                const result = await Employee.bulkWrite(operations as any);
                return NextResponse.json({ success: true, result });
            }
            case 'importReceiptsAndCosts': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid records' }, { status: 400 });

                // 1. Group records by Estimate key to minimize DB calls
                const groups = records.reduce((acc: Record<string, any[]>, r: any) => {
                    const key = String(r.estimate || r['Estimate #'] || r['Proposal Number'] || '').trim();
                    if (key) {
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(r);
                    }
                    return acc;
                }, {});

                let modifiedCount = 0;

                for (const [estKey, entries] of Object.entries(groups)) {
                    // Find the latest version of this estimate
                    const targetDoc = await Estimate.findOne({ 
                        $or: [{ _id: estKey }, { estimate: estKey }]
                    }).sort({ versionNumber: -1 });

                    if (targetDoc) {
                        const existing = targetDoc.receiptsAndCosts || [];
                        
                        for (const r of entries) {
                            const recordId = String(r._id || r.Record_ID || new Types.ObjectId().toString());
                            const cleanRecord: any = {
                                _id: recordId,
                                estimate: estKey,
                                type: (r.type || r.Type || 'Receipt') as 'Invoice' | 'Receipt',
                                vendor: String(r.vendor || r.Vendor || ''),
                                amount: parseNum(r.amount || r.Amount),
                                date: String(r.date || r.Date || ''),
                                dueDate: String(r.dueDate || r.DueDate || ''),
                                remarks: String(r.remarks || r.Remarks || ''),
                                approvalStatus: (r.approvalStatus || r.ApprovalStatus || 'Not Approved') as 'Approved' | 'Not Approved',
                                status: (r.status || r.Status || '').includes('Paid') ? 'Devco Paid' : '' as 'Devco Paid' | '',
                                paidBy: String(r.paidBy || r.PaidBy || ''),
                                paymentDate: String(r.paymentDate || r.PaymentDate || ''),
                                createdBy: String(r.createdBy || r.CreatedBy || ''),
                                createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                                upload: [] as any[],
                                tag: [] as string[]
                            };

                            if (cleanRecord.approvalStatus !== 'Approved') cleanRecord.approvalStatus = 'Not Approved';
                            if (cleanRecord.status !== 'Devco Paid') cleanRecord.status = '';

                            if (r.tag) cleanRecord.tag = String(r.tag).split(/[,;]/).map(s => s.trim()).filter(Boolean);
                            if (r.upload) {
                                const urls = String(r.upload).split(/[,;]/).map(s => s.trim()).filter(Boolean);
                                cleanRecord.upload = urls.map(url => ({
                                    name: url.split('/').pop() || 'file',
                                    url: url,
                                    type: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                                }));
                            }

                            // Update or Add
                            const idx = existing.findIndex((er: any) => String(er._id) === recordId);
                            if (idx === -1) {
                                existing.push(cleanRecord);
                            } else {
                                // CRITICAL: Avoid spreading Mongoose subdocuments {...existing[idx]} 
                                // to prevent "Maximum call stack size exceeded"
                                const existingItem = existing[idx];
                                Object.assign(existingItem, cleanRecord);
                            }
                        }

                        targetDoc.receiptsAndCosts = existing;
                        await targetDoc.save();
                        modifiedCount++;
                    }
                }
                return NextResponse.json({ success: true, count: records.length, modified: modifiedCount });
            }

            case 'importPlanningDocs': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid records' }, { status: 400 });

                // 1. Group records by Estimate key
                const groups = records.reduce((acc: Record<string, any[]>, r: any) => {
                    const key = String(r.estimate || r['Estimate #'] || r['Proposal Number'] || r.Proposal_Number || '').trim();
                    if (key) {
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(r);
                    }
                    return acc;
                }, {});

                let modifiedCount = 0;

                for (const [estKey, entries] of Object.entries(groups)) {
                    // Find the latest version of this estimate
                    const targetDoc = await Estimate.findOne({ 
                        $or: [{ _id: estKey }, { estimate: estKey }]
                    }).sort({ versionNumber: -1 });

                    if (targetDoc) {
                        const existing = targetDoc.jobPlanningDocs || [];
                        
                        for (const r of entries) {
                            const recordId = String(r._id || r.Record_ID || new Types.ObjectId().toString());
                            const cleanRecord: any = {
                                _id: recordId,
                                planningType: String(r.planningType || r.PlanningType || r['Planning Type'] || ''),
                                usaTicketNo: String(r.usaTicketNo || r.USATicketNo || r['USA Ticket No'] || ''),
                                dateSubmitted: String(r.dateSubmitted || r.DateSubmitted || r['Date Submitted'] || ''),
                                activationDate: String(r.activationDate || r.ActivationDate || r['Activation Date'] || ''),
                                expirationDate: String(r.expirationDate || r.ExpirationDate || r['Expiration Date'] || ''),
                                documentName: String(r.documentName || r.DocumentName || r['Document Name'] || ''),
                                documents: [] as any[],
                                createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                                updatedAt: new Date()
                            };

                            if (r.documents || r.Documents) {
                                const docVal = r.documents || r.Documents;
                                const urls = String(docVal).split(/[,;]/).map(s => s.trim()).filter(Boolean);
                                cleanRecord.documents = urls.map(url => ({
                                    name: url.split('/').pop() || 'file',
                                    url: url,
                                    type: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                                    uploadedAt: new Date().toISOString()
                                }));
                            }

                            // Update or Add
                            const idx = existing.findIndex((ep: any) => String(ep._id) === recordId);
                            if (idx === -1) {
                                existing.push(cleanRecord);
                            } else {
                                const existingItem = existing[idx];
                                Object.assign(existingItem, cleanRecord);
                            }
                        }

                        targetDoc.jobPlanningDocs = existing;
                        await targetDoc.save();
                        modifiedCount++;
                    }
                }
                return NextResponse.json({ success: true, count: records.length, modified: modifiedCount });
            }

            case 'updateReceiptsAndCosts': {
                const { id, receiptsAndCosts } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing estimate id' }, { status: 400 });

                const result = await Estimate.findByIdAndUpdate(
                    id,
                    { receiptsAndCosts },
                    { new: true }
                );
                return NextResponse.json({ success: true, result });
            }


            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error(`[API Error] Action: ${action || 'unknown'}, Error:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
