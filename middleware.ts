import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth', '/api/webhook', '/api/webhooks', '/api/schedules', '/api/jha', '/api/migrate-djt'];

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
        // Return 401 JSON for API routes
        if (pathname.startsWith('/api/')) {
             return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 });
        }
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
        
        // Rolling session renewal: re-issue the cookie with a fresh 30-day maxAge
        // This resets the expiration clock on every page visit
        const response = NextResponse.next();
        response.cookies.set('devco_auth_token', authToken.value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });
        return response;
    } catch {
        // Invalid token
        if (pathname.startsWith('/api/')) {
             const response = NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
             response.cookies.delete('devco_auth_token');
             return response;
        }

        // Redirect to login
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
