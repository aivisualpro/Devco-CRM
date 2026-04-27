import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate, Activity } from '@/lib/models';

import { revalidateTag } from 'next/cache';
import { Types } from 'mongoose';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const payload = await req.json();

        // 1. Fetch highest existing numerical estimate ID (e.g. 24-0010)
        const currentYear = new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2);
        
        const existingEstimates = await Estimate.find({ estimate: new RegExp(`^${yearSuffix}-`) })
            .select('estimate')
            .lean();

        let maxSeq = 0;
        const usedSequences = new Set<number>();
        existingEstimates.forEach((est: any) => {
            if (est.estimate) {
                const parts = est.estimate.split('-');
                if (parts.length === 2 && parts[0] === yearSuffix) {
                    const seq = parseInt(parts[1], 10);
                    if (!isNaN(seq)) {
                        usedSequences.add(seq);
                        if (seq > maxSeq) maxSeq = seq;
                    }
                }
            }
        });

        let nextSeq = maxSeq + 1;
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

        if (!(estimateData as any).createdBy && (estimateData as any).proposalWriter) {
            (estimateData as any).createdBy = (estimateData as any).proposalWriter;
        }

        const est = await Estimate.create(estimateData) as any;

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
                entityId: est.estimate,
                metadata: { estimate_id: est._id },
                createdAt: new Date()
            });
        } catch (e) {
            console.error('Failed to log activity:', e);
        }



        revalidateTag('schedule-counts', undefined as any);
        revalidateTag('wip-calculations', undefined as any);
        
        return NextResponse.json({ success: true, result: est });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}


export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '30');
        const search = url.searchParams.get('search') || '';
        const filter = url.searchParams.get('filter') || 'all';
        const includeBilling = url.searchParams.get('includeBilling') === 'true';
        const includeReceipts = url.searchParams.get('includeReceipts') === 'true';
        const sortKey = url.searchParams.get('sortKey') || 'updatedAt';
        const sortDirection = url.searchParams.get('sortDirection') || 'desc';
        const customerId = url.searchParams.get('customerId');

        const skip = (page - 1) * limit;
        const f = filter.toLowerCase();

        const sortDir = sortDirection === 'asc' ? 1 : -1;
        const fieldMap: Record<string, string> = {
            estimate: 'estimate', date: 'date', customerName: 'customerName',
            projectName: 'projectName', status: 'status', grandTotal: 'grandTotal',
            subTotal: 'subTotal', margin: 'margin', bidMarkUp: 'bidMarkUp',
            proposalWriter: 'proposalWriter', fringe: 'fringe', certifiedPayroll: 'certifiedPayroll',
            services: 'services', updatedAt: 'updatedAt', createdAt: 'createdAt', versionNumber: 'versionNumber'
        };
        const dbSortField = fieldMap[sortKey] || 'updatedAt';
        const mongoSort: Record<string, 1 | -1> = { [dbSortField]: sortDir };
        if (dbSortField !== 'updatedAt') mongoSort['updatedAt'] = -1;

        const useCollation = ['estimate', 'customerName', 'projectName', 'status', 'proposalWriter', 'fringe', 'certifiedPayroll'].includes(sortKey);
        const collationOptions = useCollation ? { locale: 'en', numericOrdering: true } : undefined;

        let searchOrConditions: any[] | undefined;
        if (search) {
            const regex = { $regex: search, $options: 'i' };
            searchOrConditions = [
                { estimate: regex }, { customerName: regex }, { projectTitle: regex },
                { projectName: regex }, { proposalNo: regex }, { contactName: regex },
                { status: regex }, { fringe: regex }, { certifiedPayroll: regex },
                { proposalWriter: regex }, { services: regex }, { date: regex },
                { bidMarkUp: regex }, { jobAddress: regex }, { customerJobNumber: regex },
            ];
            const numericSearch = parseFloat(search.replace(/[$,%\s]/g, ''));
            if (!isNaN(numericSearch)) {
                searchOrConditions.push({ grandTotal: numericSearch }, { subTotal: numericSearch }, { margin: numericSearch });
            }
        }

        const baseQuery: any = { status: { $ne: 'deleted' } };
        if (customerId) baseQuery.customerId = customerId;
        if (searchOrConditions) baseQuery.$or = searchOrConditions;

        const query: any = { ...baseQuery };
        if (f !== 'all' && !['thismonth', 'lastmonth'].includes(f)) {
            if (f === 'active') query.status = { $nin: ['Lost', 'Won', 'Completed', 'Confirmed', 'lost', 'won', 'completed', 'confirmed'] };
            else if (f === 'pending') query.status = 'Pending';
            else if (f === 'completed') query.status = { $in: ['Completed', 'Confirmed', 'completed', 'confirmed'] };
            else if (f === 'lost') query.status = { $in: ['Lost', 'lost'] };
            else if (f === 'won') query.status = { $in: ['Won', 'Confirmed', 'won', 'confirmed'] };
        }

        const isLite = url.searchParams.get('lite') === 'true';
        let selectFields = '-labor -equipment -material -tools -overhead -subcontractor -disposal -miscellaneous -proposals -proposal -receiptsAndCosts -billingTickets -jobPlanningDocs -releases -intentToLien -legalDocs -aerialImage -siteLayout -scopeOfWork -htmlContent -customVariables -coiDocument -notes -projectDescription -siteConditions';
        if (includeBilling) selectFields = selectFields.replace('-billingTickets', '').replace('-projectDescription', '');
        if (includeReceipts) selectFields = selectFields.replace('-receiptsAndCosts', '');
        
        if (isLite) {
            selectFields = 'estimate customerName customerId jobAddress projectName projectTitle status';
        }

        const dataQuery = Estimate.find(query).select(selectFields).sort(mongoSort).skip(skip).limit(limit);
        if (collationOptions) dataQuery.collation(collationOptions);

        const [estimates, total] = await Promise.all([
            dataQuery.lean(),
            Estimate.countDocuments(query)
        ]);

        return NextResponse.json({ success: true, result: estimates, total, page, limit });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
