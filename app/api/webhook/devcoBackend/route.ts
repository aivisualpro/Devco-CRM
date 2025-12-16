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
    Contact,
    Employee,
    Template,
    GlobalCustomVariable,
} from '@/lib/models';

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

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID)}/tables/${encodeURIComponent(APPSHEET_TABLE_NAME)}/Action`;

    const appSheetRow = {
        "Record_Id": String(data._id || ""),
        "Estimate #": String(data.estimate || ""),
        "Date": String(data.date || ""),
        "Customer": String(data.customerId || ""),
        "Proposal No": String(data.proposalNo || ""),
        "Bid Mark UP Percentage": String(data.bidMarkUp || ""),
        "Directional Drilling": toYN(Boolean(data.directionalDrilling)),
        "Excavation & Backfill": toYN(Boolean(data.excavationBackfill)),
        "Hydro-excavation": toYN(Boolean(data.hydroExcavation)),
        "Potholing & Coring": toYN(Boolean(data.potholingCoring)),
        "Asphalt & Concrete": toYN(Boolean(data.asphaltConcrete)),
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
                "ApplicationAccessKey": APPSHEET_API_KEY
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
        const body = await request.json();
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
                directionalDrilling: toBoolean(Data.directionalDrilling),
                excavationBackfill: toBoolean(Data.excavationBackfill),
                hydroExcavation: toBoolean(Data.hydroExcavation),
                potholingCoring: toBoolean(Data.potholingCoring),
                asphaltConcrete: toBoolean(Data.asphaltConcrete),
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

                const id = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const estimateData = {
                    _id: id,
                    estimate: estimateNumber,
                    date: payload?.date || new Date().toLocaleDateString(),
                    customerName: payload?.customerName || '',
                    proposalNo: payload?.proposalNo || estimateNumber,
                    status: 'draft',
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
                updateAppSheet(estimateData).catch(err => console.error('Background AppSheet sync failed:', err));
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
                const newId = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, createdAt, updatedAt, __v, ...sourceData } = sourceEst as any;

                const newEstData = {
                    ...sourceData,
                    _id: newId,
                    versionNumber: nextVersion,
                    status: 'draft',
                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const newEst = await Estimate.create(newEstData);

                // Sync to AppSheet
                updateAppSheet(newEstData).catch(err => console.error('Clone sync error:', err));

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
                const newId = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Remove fields we don't want to copy or that need reset
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, createdAt, updatedAt, __v, estimate, proposalNo, versionNumber, date, customerName, customerId, status, ...sourceData } = sourceEst as any;

                const newEstData = {
                    ...sourceData,
                    _id: newId,
                    estimate: estimateNumber,
                    proposalNo: estimateNumber,
                    versionNumber: 1,
                    customerName: '',
                    customerId: '',
                    status: 'draft',
                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const newEst = await Estimate.create(newEstData);

                // Sync to AppSheet
                updateAppSheet(newEstData).catch(err => console.error('Copy sync error:', err));

                return NextResponse.json({ success: true, result: newEst });
            }

            case 'updateEstimate': {
                const { id: estId, ...updateData } = payload || {};
                if (!estId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                // Directly update the document including all embedded arrays
                const updated = await Estimate.findByIdAndUpdate(
                    estId,
                    { ...updateData, updatedAt: new Date() },
                    { new: true }
                );

                if (updated) {
                    // Sync with AppSheet
                    await updateAppSheet(updated.toObject() as unknown as Record<string, unknown>);
                }
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteEstimate': {
                const { id: deleteId } = payload || {};
                if (!deleteId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                await Estimate.findByIdAndDelete(deleteId);
                return NextResponse.json({ success: true });
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
                const newConst = await Constant.create(payload?.item || {});
                return NextResponse.json({ success: true, result: newConst });
            }

            case 'updateConstant': {
                const { id: constId, item: constItem } = payload || {};
                if (!constId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const updated = await Constant.findByIdAndUpdate(constId, { ...constItem, updatedAt: new Date() }, { new: true });
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

                // Ensure _id is set from recordId if provided, otherwise generate one
                // If the user manually creates one, we might need to generate a recordId
                const clientData = {
                    ...item,
                    _id: item.recordId || item._id || `C-${Date.now()}`
                };

                const newClient = await Client.create(clientData);
                return NextResponse.json({ success: true, result: newClient });
            }

            case 'updateClient': {
                const { id: clientId, item: clientItem } = payload || {};
                if (!clientId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const updated = await Client.findByIdAndUpdate(clientId, { ...clientItem, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteClient': {
                const { id: clientDelId } = payload || {};
                if (!clientDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                await Client.findByIdAndDelete(clientDelId);
                return NextResponse.json({ success: true });
            }

            case 'importClients': {
                const { clients } = payload || {};
                if (!Array.isArray(clients)) return NextResponse.json({ success: false, error: 'Invalid clients array' }, { status: 400 });

                const operations = clients.map((c: any) => ({
                    updateOne: {
                        filter: { _id: c.recordId || c._id },
                        update: {
                            $set: {
                                ...c,
                                _id: c.recordId || c._id, // Enforce recordId as _id
                                updatedAt: new Date()
                            },
                            $setOnInsert: { createdAt: new Date() }
                        },
                        upsert: true
                    }
                }));

                const result = await Client.bulkWrite(operations);
                return NextResponse.json({ success: true, result });
            }


            // ========== CONTACTS ==========
            case 'getContacts': {
                const contacts = await Contact.find().sort({ fullName: 1 });
                return NextResponse.json({ success: true, result: contacts });
            }

            case 'addContact': {
                const { item } = payload || {};
                if (!item) return NextResponse.json({ success: false, error: 'Missing contact data' }, { status: 400 });

                const contactData = {
                    ...item,
                    _id: item.recordId || item._id || `CT-${Date.now()}`
                };

                const newContact = await Contact.create(contactData);
                return NextResponse.json({ success: true, result: newContact });
            }

            case 'updateContact': {
                const { id: contactId, item: contactItem } = payload || {};
                if (!contactId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const updated = await Contact.findByIdAndUpdate(contactId, { ...contactItem, updatedAt: new Date() }, { new: true });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteContact': {
                const { id: contactDelId } = payload || {};
                if (!contactDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                await Contact.findByIdAndDelete(contactDelId);
                return NextResponse.json({ success: true });
            }

            // ========== TEMPLATES ==========
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

            // ========== GLOBAL CUSTOM VARIABLES ==========
            case 'getGlobalCustomVariables': {
                const vars = await GlobalCustomVariable.find().sort({ createdAt: 1 });
                return NextResponse.json({ success: true, result: vars });
            }

            case 'saveGlobalCustomVariables': {
                const { variables } = payload || {};
                if (!Array.isArray(variables)) {
                    return NextResponse.json({ success: false, error: 'Invalid variables array' }, { status: 400 });
                }

                // Delete all existing and recreate (simple approach)
                await GlobalCustomVariable.deleteMany({});
                if (variables.length > 0) {
                    await GlobalCustomVariable.insertMany(variables);
                }
                const updated = await GlobalCustomVariable.find().sort({ createdAt: 1 });
                return NextResponse.json({ success: true, result: updated });
            }

            // ========== PROPOSALS ==========
            case 'previewProposal': {
                const { templateId, estimateId, editMode = true } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });

                const [template, estimate] = await Promise.all([
                    Template.findById(templateId).lean(),
                    Estimate.findById(estimateId).lean()
                ]);

                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!estimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                console.log('previewProposal estimate.customVariables:', (estimate as any).customVariables);

                // Resolve with editMode flag
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const html = resolveTemplateDocument(template, estimate as any, editMode);
                return NextResponse.json({ success: true, result: { html } });
            }

            case 'generateProposal': {
                const { templateId, estimateId, customVariables = {} } = payload || {};
                if (!templateId || !estimateId) return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });

                const [template, estimate] = await Promise.all([
                    Template.findById(templateId).lean(),
                    Estimate.findById(estimateId) // Keep mongoose doc for saving
                ]);

                if (!template) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
                if (!estimate) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // Save custom variables to estimate
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (estimate as any).customVariables = customVariables;
                estimate.markModified('customVariables'); // Tell Mongoose the field changed

                // Prepare estimate object for resolver
                const estimateObj = estimate.toObject() as any;
                estimateObj.customVariables = customVariables;

                // Resolve template in view mode (false) - final output without inputs
                const html = resolveTemplateDocument(template, estimateObj, false);

                // Update Estimate with Snapshot
                estimate.proposal = {
                    templateId: String(template._id),
                    templateVersion: template.version || 1,
                    generatedAt: new Date(),
                    htmlContent: html,
                    pdfUrl: '' // PDF Generation would go here (Puppeteer)
                };

                // Set active template ID
                estimate.templateId = String(template._id);

                await estimate.save();

                return NextResponse.json({ success: true, result: { html } });
            }

            case 'importContacts': {
                const { contacts } = payload || {};
                if (!Array.isArray(contacts)) return NextResponse.json({ success: false, error: 'Invalid contacts array' }, { status: 400 });

                const operations = contacts.map((c: any) => ({
                    updateOne: {
                        filter: { _id: c.recordId || c._id },
                        update: {
                            $set: {
                                ...c,
                                _id: c.recordId || c._id,
                                updatedAt: new Date()
                            },
                            $setOnInsert: { createdAt: new Date() }
                        },
                        upsert: true
                    }
                }));

                const result = await Contact.bulkWrite(operations);
                return NextResponse.json({ success: true, result });
            }

            // ========== EMPLOYEES ==========
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

                // Use email as _id
                const employeeData = {
                    ...item,
                    _id: item.email
                };

                const newEmployee = await Employee.create(employeeData);
                return NextResponse.json({ success: true, result: newEmployee });
            }

            case 'updateEmployee': {
                const { id: empId, item: empItem } = payload || {};
                if (!empId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const updated = await Employee.findByIdAndUpdate(empId, { ...empItem, updatedAt: new Date() }, { new: true });
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
                    if (!e.email) return null; // Skip if no email

                    // Parse boolean fields
                    let scheduleActive = e.isScheduleActive;
                    if (typeof scheduleActive === 'string') {
                        const val = scheduleActive.trim().toUpperCase();
                        scheduleActive = ['YES', 'Y', 'TRUE', '1'].includes(val);
                    }

                    // Parse currency fields
                    const rateSite = e.hourlyRateSITE ? parseNum(e.hourlyRateSITE) : 0;
                    const rateDrive = e.hourlyRateDrive ? parseNum(e.hourlyRateDrive) : 0;

                    // Destructure to remove parsed fields from 'rest' so we don't duplicate or overwrite
                    const { _id, isScheduleActive, hourlyRateSITE, hourlyRateDrive, ...rest } = e;

                    const finalUpdate = {
                        ...rest,
                        isScheduleActive: scheduleActive, // Use parsed boolean
                        hourlyRateSITE: rateSite,         // Use parsed number
                        hourlyRateDrive: rateDrive,       // Use parsed number
                        email: e.email,
                        updatedAt: new Date()
                    };

                    return {
                        updateOne: {
                            filter: { _id: e.email },
                            update: {
                                $set: finalUpdate,
                                $setOnInsert: {
                                    _id: e.email,
                                    createdAt: new Date()
                                }
                            },
                            upsert: true
                        }
                    };
                }).filter(Boolean); // Remove nulls

                const result = await Employee.bulkWrite(operations as any); // Cast to any to avoid complex TS mapping issues with filtered nulls
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
