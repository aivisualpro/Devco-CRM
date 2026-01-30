import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        await connectToDatabase();
        const employee = await Employee.findById(user.userId).select('reportFilters').lean();

        return NextResponse.json({ 
            success: true, 
            filters: employee?.reportFilters || {} 
        });

    } catch (error) {
        console.error('Error fetching user preferences:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { reportName, filters } = body;

        if (!reportName || !filters) {
            return NextResponse.json({ success: false, error: 'Missing reportName or filters' }, { status: 400 });
        }

        await connectToDatabase();

        // Use dot notation to update specific report filters without overwriting others
        const updateKey = `reportFilters.${reportName}`;
        
        // Use $set to update/insert the specific report's filters
        // Using flattened update path allows merging new keys into reportFilters object
        const result = await Employee.findByIdAndUpdate(
            user.userId,
            { $set: { [updateKey]: filters } },
            { new: true, upsert: false }
        ).select('reportFilters');

        return NextResponse.json({ 
            success: true, 
            filters: result?.reportFilters 
        });

    } catch (error) {
        console.error('Error saving user preferences:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
