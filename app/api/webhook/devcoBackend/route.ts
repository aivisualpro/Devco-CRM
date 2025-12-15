import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
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
    EstimateLineItemsEquipment,
    EstimateLineItemsLabor,
    EstimateLineItemsMaterial,
    EstimateLineItemsOverhead,
    EstimateLineItemsSubcontractor,
    EstimateLineItemsDisposal,
    EstimateLineItemsMiscellaneous,
    EstimateLineItemsTools,
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

function getLineItemModel(type: string) {
    const models: Record<string, typeof EstimateLineItemsEquipment> = {
        equipment: EstimateLineItemsEquipment,
        labor: EstimateLineItemsLabor,
        material: EstimateLineItemsMaterial,
        overhead: EstimateLineItemsOverhead,
        subcontractor: EstimateLineItemsSubcontractor,
        disposal: EstimateLineItemsDisposal,
        miscellaneous: EstimateLineItemsMiscellaneous,
        tools: EstimateLineItemsTools
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

                // Fetch all line items
                const [labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous] = await Promise.all([
                    EstimateLineItemsLabor.find({ estimateId: id }).lean(),
                    EstimateLineItemsEquipment.find({ estimateId: id }).lean(),
                    EstimateLineItemsMaterial.find({ estimateId: id }).lean(),
                    EstimateLineItemsTools.find({ estimateId: id }).lean(),
                    EstimateLineItemsOverhead.find({ estimateId: id }).lean(),
                    EstimateLineItemsSubcontractor.find({ estimateId: id }).lean(),
                    EstimateLineItemsDisposal.find({ estimateId: id }).lean(),
                    EstimateLineItemsMiscellaneous.find({ estimateId: id }).lean()
                ]);

                return NextResponse.json({
                    success: true,
                    result: { ...est, labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous }
                });
            }

            case 'getEstimatesByProposal': {
                const { proposalNo } = payload || {};
                if (!proposalNo) return NextResponse.json({ success: false, error: 'Missing proposalNo' }, { status: 400 });

                const estimates = await Estimate.find({ proposalNo }).sort({ createdAt: 1 }).lean();

                // Add version numbers and calculate totals
                const versioned = estimates.map((est, idx) => {
                    const e = est as unknown as Record<string, unknown>;
                    return {
                        _id: String(e._id),
                        proposalNo: e.proposalNo,
                        versionNumber: idx + 1,
                        date: e.date,
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

                // Atomically get and increment the counter
                // We use findOneAndUpdate with upsert. If it doesn't exist, it creates it with the default year.
                // We can't use $inc and $setOnInsert on the same field in a way that causes conflict.
                // Better approach: ensure it exists first or handle the logic differently.

                // First, try to increment an existing counter for the current year
                let counter = await Counter.findOneAndUpdate(
                    { _id: 'estimate_counter', year: currentYear },
                    { $inc: { seq: 1 } },
                    { new: true }
                );

                // If not found (either doesn't exist or year changed), we need to handle it
                if (!counter) {
                    // Check if it's a year change or a fresh init
                    const existingCounter = await Counter.findById('estimate_counter');

                    const startSeq = currentYear >= 2026 ? 1001 : 633;

                    if (existingCounter) {
                        // Year changed - reset
                        counter = await Counter.findByIdAndUpdate(
                            'estimate_counter',
                            {
                                year: currentYear,
                                seq: startSeq
                            },
                            { new: true }
                        );
                    } else {
                        // Fresh init - create new
                        counter = await Counter.create({
                            _id: 'estimate_counter',
                            year: currentYear,
                            seq: startSeq
                        });
                    }
                }

                const estimateNumber = `${yearSuffix}-${String(counter?.seq || 633).padStart(4, '0')}`;

                const id = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const estimateData = {
                    _id: id,
                    estimate: estimateNumber,
                    date: payload?.date || new Date().toLocaleDateString(),
                    customerName: payload?.customerName || '',
                    proposalNo: payload?.proposalNo || '',
                    status: 'draft',
                    versionNumber: 1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const est = await Estimate.create(estimateData);
                // Non-blocking AppSheet sync for speed
                updateAppSheet(estimateData).catch(err => console.error('Background AppSheet sync failed:', err));
                return NextResponse.json({ success: true, result: est });
            }

            case 'cloneEstimate': {
                const { id: sourceId } = payload || {};
                if (!sourceId) return NextResponse.json({ success: false, error: 'Missing source id' }, { status: 400 });

                // 1. Fetch Source Estimate
                const sourceEst = await Estimate.findById(sourceId);
                if (!sourceEst) return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });

                // 2. Determine Next Version
                const versions = await Estimate.find({ estimate: sourceEst.estimate })
                    .sort({ versionNumber: -1 })
                    .limit(1);

                const nextVersion = (versions[0]?.versionNumber || 1) + 1;

                // 3. Create New Estimate Document
                const newId = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const newEstData = {
                    ...sourceEst.toObject(),
                    _id: newId,
                    versionNumber: nextVersion,
                    status: 'draft',
                    date: new Date().toLocaleDateString(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    __v: 0
                };

                const newEst = await Estimate.create(newEstData);

                // 4. Clone Line Items
                const cloneSectionItems = async (model: any) => {
                    const items = await model.find({ estimateId: sourceId });
                    if (items.length > 0) {
                        const newItems = items.map((item: any) => {
                            const { _id, ...rest } = item.toObject();
                            return {
                                ...rest,
                                estimateId: newId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };
                        });
                        await model.insertMany(newItems);
                    }
                };

                await Promise.all([
                    cloneSectionItems(EstimateLineItemsLabor),
                    cloneSectionItems(EstimateLineItemsEquipment),
                    cloneSectionItems(EstimateLineItemsMaterial),
                    cloneSectionItems(EstimateLineItemsTools),
                    cloneSectionItems(EstimateLineItemsOverhead),
                    cloneSectionItems(EstimateLineItemsSubcontractor),
                    cloneSectionItems(EstimateLineItemsDisposal),
                    cloneSectionItems(EstimateLineItemsMiscellaneous),
                ]);

                // Sync to AppSheet
                updateAppSheet(newEstData).catch(err => console.error('Clone sync error:', err));

                return NextResponse.json({ success: true, result: newEst });
            }

            case 'updateEstimate': {
                const { id: estId, ...updateData } = payload || {};
                if (!estId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                const updated = await Estimate.findByIdAndUpdate(
                    estId,
                    { ...updateData, updatedAt: new Date() },
                    { new: true }
                );

                if (updated) {
                    await updateAppSheet(updated.toObject() as unknown as Record<string, unknown>);
                }
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteEstimate': {
                const { id: deleteId } = payload || {};
                if (!deleteId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                // Delete estimate and all related line items
                await Promise.all([
                    Estimate.findByIdAndDelete(deleteId),
                    EstimateLineItemsLabor.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsEquipment.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsMaterial.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsTools.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsOverhead.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsSubcontractor.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsDisposal.deleteMany({ estimateId: deleteId }),
                    EstimateLineItemsMiscellaneous.deleteMany({ estimateId: deleteId })
                ]);

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
            case 'addLineItem': {
                const { estimateId, type, item } = payload || {};
                if (!estimateId || !type || !item) {
                    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
                }

                const LineItemModel = getLineItemModel(type);
                if (!LineItemModel) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const newItem = await LineItemModel.create({ ...item, estimateId });

                // Sync to AppSheet
                const estimate = await Estimate.findById(estimateId).lean();
                if (estimate) {
                    const allItems = await fetchAllLineItems(estimateId);
                    await updateAppSheet(estimate as unknown as Record<string, unknown>, allItems);
                }

                return NextResponse.json({ success: true, result: newItem });
            }

            case 'updateLineItem': {
                const { estimateId: estLineId, type: lineType, id: lineId, item: lineItem } = payload || {};
                if (!lineType || !lineId) return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

                const LineItemModel = getLineItemModel(lineType);
                if (!LineItemModel) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                const updated = await LineItemModel.findByIdAndUpdate(lineId, { ...lineItem, updatedAt: new Date() }, { new: true });

                // Sync to AppSheet
                if (estLineId) {
                    const estimate = await Estimate.findById(estLineId).lean();
                    if (estimate) {
                        const allItems = await fetchAllLineItems(estLineId);
                        await updateAppSheet(estimate as unknown as Record<string, unknown>, allItems);
                    }
                }

                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteLineItem': {
                const { estimateId: estDelId, type: delType, id: delId } = payload || {};
                if (!delType || !delId) return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

                const LineItemModel = getLineItemModel(delType);
                if (!LineItemModel) return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

                await LineItemModel.findByIdAndDelete(delId);

                // Sync to AppSheet
                if (estDelId) {
                    const estimate = await Estimate.findById(estDelId).lean();
                    if (estimate) {
                        const allItems = await fetchAllLineItems(estDelId);
                        await updateAppSheet(estimate as unknown as Record<string, unknown>, allItems);
                    }
                }

                return NextResponse.json({ success: true });
            }

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

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// Helper to fetch all line items for an estimate
async function fetchAllLineItems(estimateId: string) {
    const [labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous] = await Promise.all([
        EstimateLineItemsLabor.find({ estimateId }).lean(),
        EstimateLineItemsEquipment.find({ estimateId }).lean(),
        EstimateLineItemsMaterial.find({ estimateId }).lean(),
        EstimateLineItemsTools.find({ estimateId }).lean(),
        EstimateLineItemsOverhead.find({ estimateId }).lean(),
        EstimateLineItemsSubcontractor.find({ estimateId }).lean(),
        EstimateLineItemsDisposal.find({ estimateId }).lean(),
        EstimateLineItemsMiscellaneous.find({ estimateId }).lean()
    ]);

    return { labor, equipment, material, tools, overhead, subcontractor, disposal, miscellaneous };
}
