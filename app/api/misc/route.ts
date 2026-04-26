// @ts-nocheck
import cloudinary from '@/lib/cloudinary';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, Client, Constant, Employee } from '@/lib/models';
import { uploadImage, uploadDocumentToR2, deleteImage, deleteDocumentFromR2 } from '@/lib/employeeUploadUtils';

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
                folder: 'signed_contracts',
                resource_type: 'image',
                format: 'png',
                page: 1
            });
            thumbUrl = thumbResult.secure_url;
        }
        return { url: mainUrl, thumbnailUrl: thumbUrl };
    } catch (e) {
        return null;
    }
}

const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
};

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { action, payload } = body;

        switch (action) {
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

            default:
                return NextResponse.json({ success: false, error: 'Unknown misc action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error(`API Misc Error [${error.action || 'unknown'}]:`, error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
