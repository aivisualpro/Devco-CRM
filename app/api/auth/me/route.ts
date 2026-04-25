import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const userPayload = await getUserFromRequest(request);
        
        if (!userPayload) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        await connectToDatabase();
        
        const employee = await Employee.findById(userPayload.userId);
        
        if (!employee) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }
        
        const { password, ...userWithoutPassword } = employee.toObject();

        return NextResponse.json({
            success: true,
            user: userWithoutPassword
        }, {
            headers: {
                'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
            }
        });
    } catch (error) {
        console.error('Error fetching current user:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch current user' },
            { status: 500 }
        );
    }
}
