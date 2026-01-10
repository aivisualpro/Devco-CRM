import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { PermissionChecker, PermissionDeniedError, isSuperAdmin } from '@/lib/permissions/service';
import { ModuleKey, ActionKey, URL_TO_MODULE } from '@/lib/permissions/types';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'devco-secure-secret-key-change-in-production'
);

// =====================================
// JWT TOKEN INTERFACE
// =====================================
export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

// =====================================
// GET USER FROM REQUEST
// =====================================
export async function getUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
    const authToken = request.cookies.get('devco_auth_token');
    
    if (!authToken?.value) {
        return null;
    }

    try {
        const { payload } = await jwtVerify(authToken.value, JWT_SECRET);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

// =====================================
// PERMISSION GUARD FOR API ROUTES
// =====================================
export type PermissionGuardOptions = {
    module: ModuleKey;
    action: ActionKey;
    allowSuperAdminBypass?: boolean; // Default true
};

export async function withPermissionGuard(
    request: NextRequest,
    options: PermissionGuardOptions,
    handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
): Promise<NextResponse> {
    const { module, action, allowSuperAdminBypass = true } = options;

    // Get user from JWT
    const user = await getUserFromRequest(request);
    
    if (!user) {
        return NextResponse.json(
            { success: false, error: 'Authentication required' },
            { status: 401 }
        );
    }

    // Super Admin bypass
    if (allowSuperAdminBypass && isSuperAdmin(user.role)) {
        const checker = new PermissionChecker(user.userId);
        await checker.load();
        return handler(checker, user);
    }

    // Load and check permissions
    const checker = new PermissionChecker(user.userId);
    await checker.load();

    if (!checker.can(module, action)) {
        return NextResponse.json(
            { 
                success: false, 
                error: 'Permission denied',
                details: `You don't have permission to ${action} on ${module}`
            },
            { status: 403 }
        );
    }

    return handler(checker, user);
}

// =====================================
// CREATE PERMISSION-AWARE API HANDLER
// =====================================
export function createPermissionHandler(module: ModuleKey) {
    return {
        // GET with view permission
        async GET(
            request: NextRequest,
            handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
        ): Promise<NextResponse> {
            return withPermissionGuard(request, { module, action: 'view' }, handler);
        },

        // POST with create permission
        async POST(
            request: NextRequest,
            handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
        ): Promise<NextResponse> {
            return withPermissionGuard(request, { module, action: 'create' }, handler);
        },

        // PUT with edit permission
        async PUT(
            request: NextRequest,
            handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
        ): Promise<NextResponse> {
            return withPermissionGuard(request, { module, action: 'edit' }, handler);
        },

        // DELETE with delete permission
        async DELETE(
            request: NextRequest,
            handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
        ): Promise<NextResponse> {
            return withPermissionGuard(request, { module, action: 'delete' }, handler);
        },

        // Custom action
        async withAction(
            request: NextRequest,
            action: ActionKey,
            handler: (checker: PermissionChecker, user: JWTPayload) => Promise<NextResponse>
        ): Promise<NextResponse> {
            return withPermissionGuard(request, { module, action }, handler);
        },
    };
}

// =====================================
// ROUTE PERMISSION CHECK (for middleware)
// =====================================
export function getModuleFromPath(pathname: string): ModuleKey | null {
    // Exact match first
    if (URL_TO_MODULE[pathname]) {
        return URL_TO_MODULE[pathname];
    }

    // Check if path starts with any known route
    for (const [route, module] of Object.entries(URL_TO_MODULE)) {
        if (pathname.startsWith(route + '/') || pathname === route) {
            return module;
        }
    }

    return null;
}

// =====================================
// ERROR HANDLER FOR PERMISSION ERRORS
// =====================================
export function handlePermissionError(error: unknown): NextResponse {
    if (error instanceof PermissionDeniedError) {
        return NextResponse.json(
            {
                success: false,
                error: 'Permission denied',
                message: error.message,
                module: error.module,
                action: error.action,
            },
            { status: 403 }
        );
    }

    console.error('Unexpected error in permission handler:', error);
    return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
    );
}

// =====================================
// EXAMPLE USAGE IN API ROUTE
// =====================================
/*
// app/api/estimates/route.ts

import { createPermissionHandler } from '@/lib/permissions/middleware';
import { MODULES } from '@/lib/permissions/types';

const permissionHandler = createPermissionHandler(MODULES.ESTIMATES);

export async function GET(request: NextRequest) {
    return permissionHandler.GET(request, async (checker, user) => {
        // checker.isSuperAdmin - true if Super Admin
        // checker.can('estimates', 'view') - check permissions
        // checker.buildFilter('estimates') - get MongoDB filter for data scope
        
        const filter = checker.buildFilter(MODULES.ESTIMATES, 'createdBy');
        const estimates = await Estimate.find(filter);
        
        return NextResponse.json({ success: true, data: estimates });
    });
}

export async function POST(request: NextRequest) {
    return permissionHandler.POST(request, async (checker, user) => {
        const body = await request.json();
        
        // Check field-level permissions
        const editableFields = checker.getEditableFields(MODULES.ESTIMATES);
        // Filter body to only include editable fields...
        
        const estimate = await Estimate.create(body);
        return NextResponse.json({ success: true, data: estimate });
    });
}
*/
