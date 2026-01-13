import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth', '/api/webhook', '/api/webhooks', '/api/schedules', '/api/jha'];

// Check if the path is public
function isPublicRoute(pathname: string): boolean {
    return publicRoutes.some(route => pathname.startsWith(route));
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (isPublicRoute(pathname)) {
        return NextResponse.next();
    }

    // Allow static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/icon') ||
        pathname.includes('.') // Static files like .css, .js, .png
    ) {
        return NextResponse.next();
    }

    // Check for authentication cookie
    const authToken = request.cookies.get('devco_auth_token');

    if (!authToken?.value) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Validate token (basic check - in production, verify JWT signature)
    try {
        // For now, just check if the token exists and is not empty
        // In production, you would verify the JWT signature here
        if (!authToken.value || authToken.value === 'undefined' || authToken.value === 'null') {
            throw new Error('Invalid token');
        }
        
        return NextResponse.next();
    } catch {
        // Invalid token, redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        // Clear invalid cookie
        response.cookies.delete('devco_auth_token');
        return response;
    }
}

// Configure which routes the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
