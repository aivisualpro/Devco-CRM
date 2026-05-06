import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Constant } from '@/lib/models';
import { DEFAULT_THRESHOLDS, FinancialThresholds } from '@/lib/constants/financialThresholds';

const QUERY = { type: 'AppSettings', value: 'financialThresholds' };

/** GET — return current thresholds (or defaults) */
export async function GET() {
    try {
        await connectToDatabase();
        const doc = await Constant.findOne(QUERY).lean();
        const data: FinancialThresholds = { ...DEFAULT_THRESHOLDS, ...(doc?.data || {}) };
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('GET financialThresholds error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** PUT — upsert thresholds */
export async function PUT(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();

        // Validate & merge with defaults
        const data: FinancialThresholds = {
            targetGrossMarginPct: Number(body.targetGrossMarginPct) || DEFAULT_THRESHOLDS.targetGrossMarginPct,
            customerConcentrationPct: Number(body.customerConcentrationPct) || DEFAULT_THRESHOLDS.customerConcentrationPct,
            dsoWarningDays: Number(body.dsoWarningDays) || DEFAULT_THRESHOLDS.dsoWarningDays,
            underBillingTolerancePct: Number(body.underBillingTolerancePct) || DEFAULT_THRESHOLDS.underBillingTolerancePct,
            overBillingTolerancePct: Number(body.overBillingTolerancePct) || DEFAULT_THRESHOLDS.overBillingTolerancePct,
        };

        await Constant.findOneAndUpdate(
            QUERY,
            { $set: { ...QUERY, data, updatedAt: new Date() } },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('PUT financialThresholds error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
