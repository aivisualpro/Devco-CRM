import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, Employee } from '@/lib/models';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();

                const body = await req.json();
        const { estimates } = body || {};
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

                    // Header Mapping for Totals (More robust aliases)
                    const grandTotalVal = getValue(e, ['Grand Total', 'grandTotal', 'Org. Cont', 'Total', 'Contract Amount', 'Amount']);
                    const subTotalVal = getValue(e, ['Sub Total', 'subTotal', 'Sub', 'Subtotal', 'Cost Amount']);
                    const marginVal = getValue(e, ['Margin', 'margin', 'Profit', 'Profit Amount']);
                    const markUpVal = getValue(e, ['Markup', 'markup', 'bidMarkUp', 'MarkUp', '%']);

                    if (grandTotalVal !== undefined) cleanData.grandTotal = grandTotalVal;
                    if (subTotalVal !== undefined) cleanData.subTotal = subTotalVal;
                    if (marginVal !== undefined) cleanData.margin = marginVal;
                    if (markUpVal !== undefined) cleanData.bidMarkUp = markUpVal;

                    // Parse Numbers
                    if (cleanData.grandTotal !== undefined) cleanData.grandTotal = parseVal(cleanData.grandTotal);
                    if (cleanData.subTotal !== undefined) cleanData.subTotal = parseVal(cleanData.subTotal);
                    if (cleanData.margin !== undefined) cleanData.margin = parseVal(cleanData.margin);

                    // If Margin is present but Grand Total is 0, attempt a reconstruction 
                    // (This helps with imports where only partial totals were provided)
                    if ((cleanData.grandTotal === 0 || !cleanData.grandTotal) && cleanData.margin > 0 && cleanData.subTotal > 0) {
                        cleanData.grandTotal = cleanData.subTotal + cleanData.margin;
                    } else if ((cleanData.margin === 0 || !cleanData.margin) && cleanData.grandTotal > 0 && cleanData.subTotal > 0) {
                        cleanData.margin = cleanData.grandTotal - cleanData.subTotal;
                    }

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


                    if (updated) {

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
                const { includeInactive } = payload || {};
                const empFilter: any = {};
                if (!includeInactive) empFilter.status = { $ne: 'Inactive' };
                const employees = await Employee.find(empFilter)
                    .select('-reportFilters -password -refreshToken -__v')
                    .sort({ firstName: 1 })
                    .lean();
                // password already excluded via .select() above
                return NextResponse.json({ success: true, result: employees });
            }

            case 'getEmployeeById': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const employee = await Employee.findById(id).select('-password -refreshToken -__v').lean();
                if (!employee) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
                // Only show password if the logged-in user is viewing their OWN record
                const isOwnRecord = userPayload && (userPayload.userId === id || userPayload.email === id);
                if (!isOwnRecord) {
                    const { password, ...rest } = employee as any;
                    return NextResponse.json({ success: true, result: rest });
                }
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
                let signatureUrl = item.signature;
                if (item.signature && item.signature.startsWith('data:image')) {
                    const uploaded = await uploadImage(item.signature, `${item.email}_signature`);
                    if (uploaded) signatureUrl = uploaded;
                }
                // Upload any base64 files in sub-document arrays to R2
                await processEmployeeSubDocFiles(item, item.email);
                const employeeData = { ...item, _id: item.email, profilePicture: profilePictureUrl, signature: signatureUrl };
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
                if (empItem.signature && empItem.signature.startsWith('data:image')) {
                    const uploaded = await uploadImage(empItem.signature, `${empId}_signature`);
                    if (uploaded) updateData.signature = uploaded;
                }
                // Upload any base64 files in sub-document arrays to R2
                await processEmployeeSubDocFiles(updateData, empId);
                const updated = await Employee.findByIdAndUpdate(empId, { ...updateData, updatedAt: new Date() }, { new: true }).select('-password -refreshToken -__v');
                if (empId) revalidateTag(`permissions-${empId}`, undefined as any);
                if (updateData.appRole) revalidateTag('permissions-all', undefined as any);
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deleteEmployee': {
                const { id: empDelId } = payload || {};
                if (!empDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Employee.findByIdAndDelete(empDelId);
                if (empDelId) revalidateTag(`permissions-${empDelId}`, undefined as any);
                return NextResponse.json({ success: true });
            }

            case 'importEmployeeCertifications': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid records array' }, { status: 400 });

                // Group records by employee_Id (the employee _id in DB)
                const groups: Record<string, any[]> = {};
                for (const r of records) {
                    const empId = String(r.employee_Id || r.empliyee_Id || r.employeeId || r.Employee_Id || '').trim();
                    if (!empId) continue;
                    if (!groups[empId]) groups[empId] = [];
                    groups[empId].push({
                        category: r.category || r.Category || '',
                        type: r.type || r.Type || '',
                        frequency: r.frequency || r.Frequency || '',
                        assignedDate: r.assignedDate || r.AssignedDate || r['Assigned Date'] || '',
                        completionDate: r.completionDate || r.CompletionDate || r['Completion Date'] || '',
                        renewalDate: r.renewalDate || r.RenewalDate || r['Renewal Date'] || '',
                        description: r.description || r.Description || '',
                        status: r.status || r.Status || '',
                        fileUrl: r.document || r.Document || r.upload || r.Upload || r.fileUrl || '',
                        createdBy: r.createdBy || r.CreatedBy || '',
                        createdAt: r.createdAt || r.CreatedAt || new Date().toISOString(),
                    });
                }

                let employeesUpdated = 0;
                let totalRecords = 0;
                for (const [empId, certs] of Object.entries(groups)) {
                    // Use native MongoDB driver to bypass Mongoose schema casting
                    const result = await Employee.collection.updateOne(
                        { _id: empId } as any,
                        { $push: { trainingCertifications: { $each: certs } } } as any
                    );
                    if (result.modifiedCount > 0) {
                        employeesUpdated++;
                        totalRecords += certs.length;
                    }
                }

                return NextResponse.json({ success: true, count: totalRecords, employeesUpdated });
            }

            case 'importEmployeeDocuments': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid records array' }, { status: 400 });

                let skippedEmpty = 0;
                const groups: Record<string, any[]> = {};
                for (const r of records) {
                    const empId = String(r.employee_id || r.employeeId || r.Employee_Id || r.EmployeeId || '').trim();
                    if (!empId) { skippedEmpty++; continue; }
                    if (!groups[empId]) groups[empId] = [];

                    groups[empId].push({
                        fileUrl: r.file || r.File || r.fileUrl || '',
                        fileName: r.fileName || r.FileName || r.filename || '',
                        expiryDate: r.expiryDate || r.ExpiryDate || r.expiry_date || '',
                        createdAt: r.createdAt || r.CreatedAt || r.created_at || new Date().toISOString(),
                    });
                }

                let employeesUpdated = 0;
                let totalDocs = 0;
                let unmatchedRecords = 0;
                const unmatchedIds: string[] = [];
                for (const [empId, docs] of Object.entries(groups)) {
                    // Try matching by _id first, then by email
                    let result = await Employee.collection.updateOne(
                        { _id: empId } as any,
                        { $push: { documents: { $each: docs } } } as any
                    );
                    if (result.modifiedCount === 0) {
                        // Fallback: try matching by email
                        result = await Employee.collection.updateOne(
                            { email: empId },
                            { $push: { documents: { $each: docs } } } as any
                        );
                    }
                    if (result.modifiedCount > 0) {
                        employeesUpdated++;
                        totalDocs += docs.length;
                    } else {
                        unmatchedRecords += docs.length;
                        unmatchedIds.push(empId);
                    }
                }

                return NextResponse.json({
                    success: true,
                    count: totalDocs,
                    employeesUpdated,
                    totalInCSV: records.length,
                    skippedEmpty,
                    unmatchedRecords,
                    unmatchedIds: unmatchedIds.slice(0, 20), // Show first 20 unmatched IDs
                });
            }

            case 'importDrugTestingRecords': {
                const { records } = payload || {};
                if (!Array.isArray(records)) return NextResponse.json({ success: false, error: 'Invalid records array' }, { status: 400 });

                // Group records by employeeId (the employee _id / email in DB)
                const groups: Record<string, any[]> = {};
                for (const r of records) {
                    const empId = String(r.employeeId || r.employee_Id || r.EmployeeId || r.Employee_Id || '').trim();
                    if (!empId) continue;
                    if (!groups[empId]) groups[empId] = [];

                    // Collect doc1-doc4 into a files array, filtering out empty values
                    const files = [
                        r.doc1 || r.Doc1 || '',
                        r.doc2 || r.Doc2 || '',
                        r.doc3 || r.Doc3 || '',
                        r.doc4 || r.Doc4 || '',
                    ].filter(f => f.trim() !== '');

                    groups[empId].push({
                        date: r.date || r.Date || '',
                        type: r.type || r.Type || '',
                        description: r.description || r.Description || '',
                        fileUrl: files[0] || '',
                        files,
                        createdBy: r.createdBy || r.CreatedBy || '',
                        createdAt: r.createdAt || r.CreatedAt || new Date().toISOString(),
                    });
                }

                let employeesUpdated = 0;
                let totalRecords2 = 0;
                for (const [empId, recs] of Object.entries(groups)) {
                    const result = await Employee.collection.updateOne(
                        { _id: empId } as any,
                        { $push: { drugTestingRecords: { $each: recs } } } as any
                    );
                    if (result.modifiedCount > 0) {
                        employeesUpdated++;
                        totalRecords2 += recs.length;
                    }
                }

                return NextResponse.json({ success: true, count: totalRecords2, employeesUpdated });
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
                revalidateTag('permissions-all', undefined as any);
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


            case 'importBillingTickets': {
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
                        const existing = (targetDoc as any).billingTickets || [];

                        for (const r of entries) {
                            const recordId = String(r._id || r.Record_ID || new Types.ObjectId().toString());

                            // Parse links array
                            let links: string[] = [];
                            if (r.links || r.Links) {
                                links = String(r.links || r.Links).split(/[,;]/).map(s => s.trim()).filter(Boolean);
                            }

                            // Parse titleDescriptions (format: "title1:desc1|title2:desc2" or JSON)
                            let titleDescriptions: { title: string; description: string }[] = [];
                            const tdRaw = r.titleDescriptions || r.TitleDescriptions || r['Title Descriptions'];
                            if (tdRaw) {
                                try {
                                    // Try JSON first
                                    titleDescriptions = JSON.parse(tdRaw);
                                } catch {
                                    // Fallback: pipe-separated "title:desc" pairs
                                    titleDescriptions = String(tdRaw).split('|').map(pair => {
                                        const [title, ...descParts] = pair.split(':');
                                        return { title: title?.trim() || '', description: descParts.join(':').trim() };
                                    }).filter(td => td.title || td.description);
                                }
                            }

                            const cleanRecord: any = {
                                _id: recordId,
                                estimate: estKey,
                                date: String(r.date || r.Date || ''),
                                billingTerms: String(r.billingTerms || r.BillingTerms || r['Billing Terms'] || ''),
                                otherBillingTerms: String(r.otherBillingTerms || r.OtherBillingTerms || ''),
                                fileName: String(r.fileName || r.FileName || r['File Name'] || ''),
                                links,
                                titleDescriptions,
                                lumpSum: String(r.lumpSum || r.LumpSum || r['Lump Sum'] || ''),
                                createdBy: String(r.createdBy || r.CreatedBy || ''),
                                createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                                uploads: [] as any[]
                            };

                            // Parse uploads if present
                            if (r.uploads || r.Uploads) {
                                const urls = String(r.uploads || r.Uploads).split(/[,;]/).map(s => s.trim()).filter(Boolean);
                                cleanRecord.uploads = urls.map(url => ({
                                    name: url.split('/').pop() || 'file',
                                    url: url,
                                    type: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                                }));
                            }

                            // Update or Add
                            const idx = existing.findIndex((eb: any) => String(eb._id) === recordId);
                            if (idx === -1) {
                                existing.push(cleanRecord);
                            } else {
                                const existingItem = existing[idx];
                                Object.assign(existingItem, cleanRecord);
                            }
                        }

                        (targetDoc as any).billingTickets = existing;
                        await targetDoc.save();
                        modifiedCount++;
                    }
                }
                return NextResponse.json({ success: true, count: records.length, modified: modifiedCount });
            }

            case 'getEquipmentItems': {
                const { default: EquipmentItemModel } = await import('@/lib/models/EquipmentItem');
                const equipmentItems = await EquipmentItemModel.find({}).sort({ classification: 1, equipmentMachine: 1 }).lean();
                return NextResponse.json({ success: true, result: equipmentItems });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
