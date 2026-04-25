import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';

const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ estimateNumber: string }> }) {
    try {
        await connectToDatabase();
        const { estimateNumber } = await params;

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
                status: e.status,
                isChangeOrder: e.isChangeOrder === true,
                parentVersionId: e.parentVersionId
            };
        });

        return NextResponse.json({ success: true, result: versioned });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
