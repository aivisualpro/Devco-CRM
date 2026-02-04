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

        // Add cache headers for faster subsequent loads
        // stale-while-revalidate: serve cached immediately, refresh in background
        const response = NextResponse.json({
            success: true,
            permissions,
            cached,
            user: {
                userId: user.userId,
                email: user.email,
                role: user.role
            }
        });
        
        // Cache for 60 seconds, stale for up to 5 minutes
        response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=300');
        
        return response;
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch permissions' },
            { status: 500 }
        );
    }
}

