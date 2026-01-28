import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { getUserPermissions, createCachedPermissions } from '@/lib/permissions/service';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const permissions = await getUserPermissions(user.userId);
        
        if (!permissions) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        // Also return cached version for quick checks
        const cached = createCachedPermissions(permissions);

        return NextResponse.json({
            success: true,
            permissions,
            cached,
            user: {
                userId: user.userId,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch permissions' },
            { status: 500 }
        );
    }
}
