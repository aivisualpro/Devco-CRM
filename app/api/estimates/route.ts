import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';
import { atlasSearch, atlasSearchCount, AtlasSearchField } from '@/lib/atlasSearch';

import { revalidateTag } from 'next/cache';
import { Types } from 'mongoose';

const ESTIMATE_SEARCH_FIELDS: AtlasSearchField[] = [
    { path: 'estimate', boost: 5 },
    { path: 'customerName', boost: 4 },
    { path: 'projectName', boost: 3 },
    { path: 'projectTitle', boost: 3 },
    { path: 'proposalNo', boost: 3 },
    { path: 'proposalWriter', boost: 2 },
    { path: 'services', boost: 1 },
    { path: 'jobAddress', boost: 2 },
    { path: 'contactName', boost: 1 },
    { path: 'status', boost: 1 },
];

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
            // await Activity.create(...)
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

        const hasSearch = search.length > 0;

        // Build status/filter conditions
        const statusFilter: any = { status: { $ne: 'deleted' } };
        if (customerId) statusFilter.customerId = customerId;
        if (f !== 'all' && !['thismonth', 'lastmonth'].includes(f)) {
            if (f === 'active') statusFilter.status = { $nin: ['Lost', 'Won', 'Completed', 'Confirmed', 'lost', 'won', 'completed', 'confirmed'] };
            else if (f === 'pending') statusFilter.status = 'Pending';
            else if (f === 'completed') statusFilter.status = { $in: ['Completed', 'Confirmed', 'completed', 'confirmed'] };
            else if (f === 'lost') statusFilter.status = { $in: ['Lost', 'lost'] };
            else if (f === 'won') statusFilter.status = { $in: ['Won', 'Confirmed', 'won', 'confirmed'] };
        }

        const isLite = url.searchParams.get('lite') === 'true';
        let selectFields = '-labor -equipment -material -tools -overhead -subcontractor -disposal -miscellaneous -proposals -proposal -receiptsAndCosts -billingTickets -jobPlanningDocs -releases -intentToLien -legalDocs -aerialImage -siteLayout -scopeOfWork -htmlContent -customVariables -coiDocument -notes -projectDescription -siteConditions';
        if (includeBilling) selectFields = selectFields.replace('-billingTickets', '').replace('-projectDescription', '');
        if (includeReceipts) selectFields = selectFields.replace('-receiptsAndCosts', '');
        
        if (isLite) {
            selectFields = 'estimate customerName customerId jobAddress projectName projectTitle status';
        }

        let estimates: any[];
        let total: number;

        if (hasSearch) {
            // Use Atlas Search (with automatic regex fallback)
            const [searchResult, countResult] = await Promise.all([
                atlasSearch({
                    model: Estimate,
                    query: search,
                    fields: ESTIMATE_SEARCH_FIELDS,
                    postFilter: statusFilter,
                    limit,
                    skip,
                    sort: mongoSort,
                    fuzzyMaxEdits: 1,
                }),
                atlasSearchCount(Estimate, search, ESTIMATE_SEARCH_FIELDS, statusFilter),
            ]);
            estimates = searchResult.items;
            total = countResult;
        } else {
            // No search — standard find
            const dataQuery = Estimate.find(statusFilter).select(selectFields).sort(mongoSort).skip(skip).limit(limit);
            if (collationOptions) dataQuery.collation(collationOptions);

            [estimates, total] = await Promise.all([
                dataQuery.lean(),
                Estimate.countDocuments(statusFilter)
            ]);
        }

        // Compute filter counts on page 1 only (avoid re-computing on scroll loads)
        let filterCounts: Record<string, number> | undefined;
        if (page === 1) {
            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

            const baseFilter: any = { status: { $ne: 'deleted' } };
            if (customerId) baseFilter.customerId = customerId;

            const [all, pending, completed, won, lost, thisMonthCount, lastMonthCount] = await Promise.all([
                Estimate.countDocuments(baseFilter),
                Estimate.countDocuments({ ...baseFilter, status: 'Pending' }),
                Estimate.countDocuments({ ...baseFilter, status: { $in: ['Completed', 'Confirmed', 'completed', 'confirmed'] } }),
                Estimate.countDocuments({ ...baseFilter, status: { $in: ['Won', 'Confirmed', 'won', 'confirmed'] } }),
                Estimate.countDocuments({ ...baseFilter, status: { $in: ['Lost', 'lost'] } }),
                Estimate.countDocuments({ ...baseFilter, createdAt: { $gte: thisMonthStart } }),
                Estimate.countDocuments({ ...baseFilter, createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
            ]);
            filterCounts = { all, pending, completed, won, lost, thisMonth: thisMonthCount, lastMonth: lastMonthCount };
        }

        return NextResponse.json({ success: true, result: estimates, total, page, limit, ...(filterCounts ? { filterCounts } : {}) });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
