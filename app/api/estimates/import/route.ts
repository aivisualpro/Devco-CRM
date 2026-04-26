import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, Employee, Client } from '@/lib/models';
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
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
