import { NextRequest, NextResponse } from 'next/server';
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

    Employee,
    Template,
    GlobalCustomVariable,
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
        // Standard URLs: .../upload/v1234/folder/file.ext
        // With Transformations: .../upload/w_400,h_533.../v1234/folder/file.ext

        while (startIndex < parts.length) {
            const segment = parts[startIndex];
            // If it's a version (v followed by digits) or a transformation (contains _), skip it
            if (segment.match(/^v\d+$/) || segment.includes(',') || segment.includes('_')) {
                startIndex++;
            } else {
                break;
            }
        }

        const pathWithExt = parts.slice(startIndex).join('/');
        const publicId = pathWithExt.replace(/\.[^/.]+$/, "");

        console.log('Deleting Cloudinary PublicID:', publicId);
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

        // Fallback for Word/Excel/etc.
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

// Helper to upload documents to R2
export async function uploadDocumentToR2(base64String: string, fileName: string, contentType: string) {
    return await uploadToR2(base64String, `documents/${fileName}`, contentType);
}


// AppSheet Configuration
const APPSHEET_APP_ID = process.env.DEVCOAPPSHEET_APP_ID;
const APPSHEET_API_KEY = process.env.DEVCOAPPSHEET_ACCESS;
const APPSHEET_TABLE_NAME = "Estimates";

// Helper functions
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
async function updateAppSheet(data: Record<string, unknown>, lineItems: Record<string, unknown[]> | null = null) {
    return { skipped: true }; // Force disable sync
    if (!APPSHEET_APP_ID || !APPSHEET_API_KEY) {

        console.log("AppSheet credentials not configured, skipping sync");
        return { skipped: true, reason: "No AppSheet credentials" };
    }

    await connectToDatabase();

    // Get constants for fringe calculations
    const constants = await Constant.find({}).lean();

    // Use provided line items or empty arrays
    const items = lineItems || {
        labor: [],
        equipment: [],
        material: [],
        tools: [],
        overhead: [],
        subcontractor: [],
        disposal: [],
        miscellaneous: []
    };

    const getFringeRate = (desc: string): number => {
        if (!desc) return 0;
        const c = constants.find((con: { description?: string }) => con.description === desc);
        return c ? parseNum((c as { value?: string }).value) : 0;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateLaborTotal = (item: any): number => {
        const subClass = (item.subClassification || '').toLowerCase();
        if (subClass === 'per diem' || subClass === 'hotel') {
            return parseNum(item.basePay) * parseNum(item.quantity) * parseNum(item.days);
        }
        const basePay = parseNum(item.basePay);
        const qty = parseNum(item.quantity);
        const days = parseNum(item.days);
        const otPd = parseNum(item.otPd);
        const wCompPct = parseNum(item.wCompPercent);
        const taxesPct = parseNum(item.payrollTaxesPercent);
        const fringeRate = getFringeRate(item.fringe);
        const totalHours = qty * days * 8;
        const totalOtHours = qty * days * otPd;
        const wCompTaxAmount = basePay * (wCompPct / 100);
        const payrollTaxAmount = basePay * (taxesPct / 100);
        const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
        const fringeAmount = fringeRate;
        const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;
        const otBasePay = basePay * 1.5;
        const otRate = otBasePay + wCompTaxAmount + otPayrollTaxAmount + fringeAmount;
        return (totalHours * baseRate) + (totalOtHours * otRate);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateEquipmentTotal = (item: any): number => {
        const qty = item.quantity || 0;
        const times = item.times !== undefined ? item.times : 1;
        const uom = item.uom || 'Daily';
        let val = 0;
        if (uom === 'Daily') val = (item.dailyCost || 0);
        else if (uom === 'Weekly') val = (item.weeklyCost || 0);
        else if (uom === 'Monthly') val = (item.monthlyCost || 0);
        else val = (item.dailyCost || 0);
        return val * qty * times;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simpleSum = (arr: any[]): number => arr.reduce((sum, i) => sum + ((i.cost || 0) * (i.quantity || 1)), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const costOnlySum = (arr: any[]): number => arr.reduce((sum, i) => sum + (i.cost || 0), 0);

    const laborTotal = (items.labor as unknown[]).reduce((sum: number, item) => sum + calculateLaborTotal(item), 0);
    const equipmentTotal = (items.equipment as unknown[]).reduce((sum: number, item) => sum + calculateEquipmentTotal(item), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const materialTotal = simpleSum(items.material as any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolsTotal = simpleSum(items.tools as any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overheadTotal = simpleSum(items.overhead as any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subcontractorTotal = costOnlySum(items.subcontractor as any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disposalTotal = simpleSum(items.disposal as any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const miscellaneousTotal = simpleSum(items.miscellaneous as any[]);

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID || "")}/tables/${encodeURIComponent(APPSHEET_TABLE_NAME)}/Action`;

    const appSheetRow = {
        "Record_Id": String(data._id || ""),
        "Estimate #": String(data.estimate || ""),
        "Date": String(data.date || ""),
        "Customer": String(data.customerId || ""),
        "Proposal No": String(data.proposalNo || ""),
        "Bid Mark UP Percentage": String(data.bidMarkUp || ""),
        "Directional Drilling": toYN((data.services as string[])?.includes("Directional Drilling")),
        "Excavation & Backfill": toYN((data.services as string[])?.includes("Excavation & Backfill")),
        "Hydro-excavation": toYN((data.services as string[])?.includes("Hydro Excavation")),
        "Potholing & Coring": toYN((data.services as string[])?.includes("Potholing & Coring")),
        "Asphalt & Concrete": toYN((data.services as string[])?.includes("Asphalt & Concrete")),

        "Fringe": String(data.fringe || ""),
        "Labor": String(laborTotal.toFixed(2)),
        "Equipment": String(equipmentTotal.toFixed(2)),
        "Material": String(materialTotal.toFixed(2)),
        "Tools": String(toolsTotal.toFixed(2)),
        "Overhead": String(overheadTotal.toFixed(2)),
        "Subcontractor": String(subcontractorTotal.toFixed(2)),
        "Disposal": String(disposalTotal.toFixed(2)),
        "Miscellaneous": String(miscellaneousTotal.toFixed(2)),
        "subTotal": String((data.subTotal as number || 0).toFixed(2)),
        "margin": String((data.margin as number || 0).toFixed(2)),
        "grandTotal": String((data.grandTotal as number || 0).toFixed(2))
    };

    try {
        const response = await fetch(APPSHEET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApplicationAccessKey": APPSHEET_API_KEY || ""
            },
            body: JSON.stringify({
                Action: "Edit",
                Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                Rows: [appSheetRow]
            })
        });

        if (!response.ok) {
            console.error("AppSheet Error:", response.status);
            return { success: false, status: response.status };
        }
        return { success: true };
    } catch (error) {
        console.error("AppSheet Error:", error);
        return { success: false, error: String(error) };
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

export async function POST(request: NextRequest) {
    try {
        const text = await request.text();
        if (!text) {
            return NextResponse.json({ success: false, error: 'Empty body' }, { status: 400 });
        }
        const body = JSON.parse(text);
        const { action, payload, Data } = body;

        await connectToDatabase();

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
            case 'getEstimates': {
                const estimates = await Estimate.find().sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: estimates });
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

                // Format: EstimateNumber-V[VersionNumber]
                // Use lastIndexOf to handle potential '-V' in the estimate number itself safely
                const lastIndex = slug.lastIndexOf('-V');
                if (lastIndex === -1) return NextResponse.json({ success: false, error: 'Invalid slug format' }, { status: 400 });

                const estimateNumber = slug.substring(0, lastIndex);
                const versionStr = slug.substring(lastIndex + 2);
                const versionNumber = parseInt(versionStr, 10);

                if (isNaN(versionNumber)) return NextResponse.json({ success: false, error: 'Invalid version number' }, { status: 400 });

                const est = await Estimate.findOne({ estimate: estimateNumber, versionNumber }).lean();

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
                        status: e.status
                    };
                });

                return NextResponse.json({ success: true, result: versioned });
            }

            case 'createEstimate': {
                // Get current year (last 2 digits)
                const currentYear = new Date().getFullYear();
                const yearSuffix = currentYear.toString().slice(-2);
                const startSeq = 633;

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

                const est = await Estimate.create(estimateData);
                // updateAppSheet(estimateData).catch(err => console.error('Background AppSheet sync failed:', err));

                return NextResponse.json({ success: true, result: est });
            }

            case 'cloneEstimate': {
                const { id: sourceId } = payload || {};
                if (!sourceId) return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });

                // 1. Fetch Source Estimate
                const sourceEst = await Estimate.findById(sourceId).lean();
                if (!sourceEst) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // 2. Determine Next Version
                const versions = await Estimate.find({ estimate: sourceEst.estimate })
                    .sort({ versionNumber: -1 })
                    .limit(1);

                const nextVersion = (versions[0]?.versionNumber || 1) + 1;

                // 3. Create New Estimate Document
                const newId = `${sourceEst.estimate}-V${nextVersion}`;

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

                // Sync to AppSheet
                // updateAppSheet(newEstData).catch(err => console.error('Clone sync error:', err));


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
                const startSeq = 633;

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

                // Sync to AppSheet
                // updateAppSheet(newEstData).catch(err => console.error('Copy sync error:', err));


                return NextResponse.json({ success: true, result: newEst });
            }

            case 'updateEstimate': {
                const { id: estId, ...updateData } = payload || {};
                if (!estId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                // Debug: Log incoming fringe value
                console.log('updateEstimate - fringe value:', updateData.fringe);

                // Directly update the specific version document
                const updated = await Estimate.findByIdAndUpdate(
                    estId,
                    { ...updateData, updatedAt: new Date() },
                    { new: true }
                );

                if (updated && updated.estimate) {
                    // Fields that should be synced across ALL versions of this estimate
                    const SHARED_FIELDS = [
                        'projectName', 'jobAddress', 'customerId', 'customerName',
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

                // AppSheet sync disabled temporarily
                // if (updated) {
                //     await updateAppSheet(updated.toObject() as unknown as Record<string, unknown>);
                // }
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteEstimate': {
                const { id: deleteId } = payload || {};
                if (!deleteId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                await Estimate.findByIdAndDelete(deleteId);
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
                        active: con.active !== undefined ? con.active : (idx === 0)
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
                            active: contacts.length === 0
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
                            active: contacts.length === 0
                        });
                    }
                }

                if (contacts.length > 0 && !contacts.some(con => con.active)) {
                    contacts[0].active = true;
                }

                const clientData = {
                    ...item,
                    contacts,
                    _id: item.recordId || item._id || `C-${Date.now()}`
                };
                delete (clientData as any).accountingContact;
                delete (clientData as any).accountingEmail;
                delete (clientData as any).contactFullName;
                delete (clientData as any).email;
                delete (clientData as any).phone;

                const newClient = await Client.create(clientData);
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
                                    active: contacts.length === 0
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
                                    active: contacts.length === 0
                                });
                            }
                        }

                        // Clean up legacy fields from update object
                        delete (clientItem as any).accountingContact;
                        delete (clientItem as any).accountingEmail;
                        delete (clientItem as any).contactFullName;
                        delete (clientItem as any).email;
                        delete (clientItem as any).phone;

                        // Ensure all contacts have type and active status
                        const processedContacts = contacts.map((con, idx) => ({
                            ...con,
                            type: con.type || 'Main Contact',
                            active: con.active !== undefined ? con.active : (idx === 0)
                        }));

                        // Ensure exactly one is active if any exist
                        if (processedContacts.length > 0 && !processedContacts.some(con => con.active)) {
                            processedContacts[0].active = true;
                        }

                        clientItem.contacts = processedContacts;
                    }

                    const updated = await Client.findByIdAndUpdate(
                        clientId,
                        { ...clientItem, updatedAt: new Date() },
                        { new: true, strict: false }
                    );
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
                        updateData.addresses = [client.businessAddress];
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
                const newTemplate = await Template.create(payload?.item || {});
                return NextResponse.json({ success: true, result: newTemplate });
            }

            case 'updateTemplate': {
                const { id: tempId, item: tempItem } = payload || {};
                if (!tempId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
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
                const newTemplate = await Template.create({
                    ...rest,
                    title: `${rest.title} (Copy)`,
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
                const { templateId, estimateId, editMode = true, estimateData } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });
                const [template, dbEstimate] = await Promise.all([
                    Template.findById(templateId).lean(),
                    Estimate.findById(estimateId).lean()
                ]);
                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!dbEstimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });
                const estimate = estimateData ? { ...dbEstimate, ...estimateData } : dbEstimate;
                const html = resolveTemplateDocument(template, estimate as any, editMode);
                return NextResponse.json({ success: true, result: { html } });
            }

            case 'generateProposal': {
                const { templateId, estimateId, customVariables = {} } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });
                const [template, estimate] = await Promise.all([
                    Template.findById(templateId).lean(),
                    Estimate.findById(estimateId)
                ]);
                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!estimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });
                (estimate as any).customVariables = customVariables;
                estimate.markModified('customVariables');
                const estimateObj = estimate.toObject() as any;
                estimateObj.customVariables = customVariables;
                const html = resolveTemplateDocument(template, estimateObj, false);
                estimate.proposal = {
                    templateId: String(template._id),
                    templateVersion: template.version || 1,
                    generatedAt: new Date(),
                    htmlContent: html,
                    pdfUrl: ''
                };
                estimate.templateId = String(template._id);
                await estimate.save();
                return NextResponse.json({ success: true, result: { html } });
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

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
