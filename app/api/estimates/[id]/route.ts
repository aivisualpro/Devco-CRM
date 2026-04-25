import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, DevcoQuickBooks, Activity } from '@/lib/models';
import { serializeEstimate } from '@/lib/serializers/estimate';
import { QBO_OWNED_FIELDS, DEVCO_OWNED_FIELDS } from '@/lib/qbo-sync-contract';

import { revalidateTag } from 'next/cache';
import { Types } from 'mongoose';

async function findEstimate(id: string) {
    // Try by ObjectId first
    if (Types.ObjectId.isValid(id)) {
        const est = await Estimate.findById(id);
        if (est) return est;
    }
    
    // Try as exact slug
    let est = await Estimate.findById(id); // sometimes slugs are used as _id (e.g. V1-CO1)
    if (est) return est;
    
    // Fallback to slug parsing: EstimateNumber-V[VersionNumber]
    const lastIndex = id.lastIndexOf('-V');
    if (lastIndex !== -1) {
        const estimateNumber = id.substring(0, lastIndex);
        const versionStr = id.substring(lastIndex + 2);
        const versionNumber = parseInt(versionStr, 10);

        if (!isNaN(versionNumber)) {
            est = await Estimate.findOne({ estimate: estimateNumber, versionNumber });
            if (est) return est;
        }
    }
    return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id } = await params;

        const est = await findEstimate(id);
        if (!est) {
            return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        }

        // Fetch QB overlay
        let qbDoc = null;
        if (est.estimate) {
            qbDoc = await DevcoQuickBooks.findOne({ proposalNumber: est.estimate });
        }

        const result = serializeEstimate(est, qbDoc);

        // Ensure legacy arrays exist as the old route did
        const finalResult = {
            ...result,
            labor: result.labor || [],
            equipment: result.equipment || [],
            material: result.material || [],
            tools: result.tools || [],
            overhead: result.overhead || [],
            subcontractor: result.subcontractor || [],
            disposal: result.disposal || [],
            miscellaneous: result.miscellaneous || []
        };

        return NextResponse.json({ success: true, result: finalResult });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id } = await params;
        const body = await req.json();

        // 1. Identify which fields the user is changing
        const keys = Object.keys(body);
        
        // 2. Reject if QBO_OWNED_FIELDS
        const hasQboOwned = keys.some(k => (QBO_OWNED_FIELDS as readonly string[]).includes(k));
        if (hasQboOwned) {
            return NextResponse.json({ 
                success: false, 
                error: 'This field is managed by QuickBooks and cannot be edited.' 
            }, { status: 400 });
        }

        const currentEst = await findEstimate(id);
        if (!currentEst) {
            return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        }
        
        // === STATUS PROTECTION ===
        if (body.status && body.status === 'Lost') {
            if (currentEst.estimate) {
                const siblingWithWonOrCompleted = await Estimate.findOne({
                    estimate: currentEst.estimate,
                    _id: { $ne: currentEst._id },
                    status: { $in: ['Won', 'Completed'] }
                }).lean();
                if (siblingWithWonOrCompleted) {
                    return NextResponse.json({
                        success: false,
                        error: `Cannot mark as Lost — Version ${siblingWithWonOrCompleted.versionNumber || ''} is already "${siblingWithWonOrCompleted.status}". A won/completed estimate cannot have a lost sibling.`
                    }, { status: 400 });
                }
            }
        }

        // 3. Save DEVCO_OWNED_FIELDS to DevcoQuickBooks
        const devcoOwnedUpdates: any = {};
        let hasDevcoOwned = false;
        const estimateUpdates: any = {};

        for (const key of keys) {
            if ((DEVCO_OWNED_FIELDS as readonly string[]).includes(key)) {
                devcoOwnedUpdates[key] = body[key];
                hasDevcoOwned = true;
            } else {
                estimateUpdates[key] = body[key];
            }
        }

        if (hasDevcoOwned && currentEst.estimate) {
            await DevcoQuickBooks.findOneAndUpdate(
                { proposalNumber: currentEst.estimate },
                { $set: devcoOwnedUpdates },
                { upsert: true, new: true }
            );
        }

        // 4. Save normally to Estimate
        const updated = await Estimate.findByIdAndUpdate(
            currentEst._id,
            { ...estimateUpdates, updatedAt: new Date() },
            { new: true }
        );

        // Log Activity
        if (updated) {
            try {
                const activityId = new Types.ObjectId().toString();
                await Activity.create({
                    _id: activityId,
                    user: (() => {
                        const u = estimateUpdates.proposalWriter ||
                            estimateUpdates.createdBy ||
                            updated?.proposalWriter ||
                            'System';
                        return Array.isArray(u) ? u.join(', ') : String(u);
                    })(),
                    action: 'updated_estimate',
                    type: 'estimate',
                    title: `Updated Estimate #${updated.estimate}`,
                    entityId: updated.estimate, 
                    metadata: { estimate_id: updated._id },
                    createdAt: new Date()
                });
            } catch (e) {
                console.error('Failed to log activity:', e);
            }


            
            // Sync Shared Fields to Siblings
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
                'prelimAmount', 'billingTerms', 'otherBillingTerms',
                'fringe', 'certifiedPayroll', 'prevailingWage',
                'estimateVendorsSubContractors', 'services', 'proposalWriter'
            ];

            const sharedUpdate: Record<string, any> = {};
            let hasSharedUpdates = false;

            SHARED_FIELDS.forEach(field => {
                if (estimateUpdates[field] !== undefined) {
                    sharedUpdate[field] = estimateUpdates[field];
                    hasSharedUpdates = true;
                }
            });

            if (hasSharedUpdates) {
                await Estimate.updateMany(
                    { estimate: updated.estimate, _id: { $ne: updated._id } },
                    { $set: { ...sharedUpdate, updatedAt: new Date() } }
                );
            }
            

        }

        // 5. Call revalidateTag
        revalidateTag(`estimate-${id}`, undefined as any);
        revalidateTag('estimates-list', undefined as any);
        revalidateTag('quickbooks-projects', undefined as any);
        revalidateTag('wip-calculations', undefined as any);
        revalidateTag('schedule-counts', undefined as any);

        return NextResponse.json({ success: true, message: 'Updated', result: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id } = await params;

        const est = await findEstimate(id);
        if (!est) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

        await Estimate.findByIdAndDelete(est._id);

        revalidateTag('estimates-list', undefined as any);
        revalidateTag(`estimate-${id}`, undefined as any);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
