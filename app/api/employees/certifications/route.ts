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
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
