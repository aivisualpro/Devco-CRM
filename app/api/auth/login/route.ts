import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Find employee by email (case-insensitive search often preferred for email, but let's stick to direct match first or standard lowercase convention if enforced)
        // Adjusting to findOne with case-insensitive email if possible, or just direct match.
        // Assuming email is stored as provided.
        const employee = await Employee.findOne({ email });

        if (!employee) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check if employee is active
        if (employee.status !== 'Active') {
            return NextResponse.json(
                { success: false, error: 'Account is not active' },
                { status: 403 }
            );
        }

        // Check password
        // Note: In a real app, passwords should be hashed. The user asked for "matching with password field", implying direct comparison for now.
        // I will implement direct comparison as requested/implied by "add a field... password".
        if (employee.password !== password) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Login successful
        // Return user info (excluding password)
        const { password: _, ...userWithoutPassword } = employee.toObject();

        return NextResponse.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'An error occurred during login' },
            { status: 500 }
        );
    }
}
