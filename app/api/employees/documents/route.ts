import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { records } = body || {};
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
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
