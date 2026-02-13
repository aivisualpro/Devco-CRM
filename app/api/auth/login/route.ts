import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { SignJWT } from 'jose';

// Secret key for JWT - should be in environment variables
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'devco-secure-secret-key-change-in-production'
);

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

        // Find employee by email (case-insensitive)
        const employee = await Employee.findOne({ 
            email: { $regex: new RegExp(`^${email}$`, 'i') }
        });

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
        // TODO: In production, use bcrypt to hash and compare passwords
        if (employee.password !== password) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Create JWT token
        const token = await new SignJWT({
            userId: employee._id,
            email: employee.email,
            role: employee.appRole || 'Employee',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d')
            .sign(JWT_SECRET);

        // Return user info (excluding password)
        const { password: _, ...userWithoutPassword } = employee.toObject();

        // Create response with HTTP-only cookie
        const response = NextResponse.json({
            success: true,
            user: userWithoutPassword
        });

        // Set secure HTTP-only cookie
        response.cookies.set('devco_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'An error occurred during login' },
            { status: 500 }
        );
    }
}
