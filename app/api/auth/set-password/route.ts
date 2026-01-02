import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';

// This endpoint sets a password for an employee
// Protected by a secret key that must be passed in the request
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, adminSecret } = body;

        // Validate admin secret
        const expectedSecret = process.env.ADMIN_SECRET || process.env.JWT_SECRET || 'devco-admin-setup-2024';
        
        if (adminSecret !== expectedSecret) {
            return NextResponse.json(
                { success: false, error: 'Invalid admin secret' },
                { status: 403 }
            );
        }

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Find and update the employee
        const result = await Employee.updateOne(
            { email: { $regex: new RegExp(`^${email}$`, 'i') } },
            { $set: { password: password } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'Employee not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Password set for ${email}`
        });

    } catch (error) {
        console.error('Set password error:', error);
        return NextResponse.json(
            { success: false, error: 'An error occurred' },
            { status: 500 }
        );
    }
}
