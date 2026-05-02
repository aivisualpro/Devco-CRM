import { NextResponse } from 'next/server';

// This endpoint returns the current build ID.
// Next.js generates a unique build ID per deployment — the client polls this
// to detect when a new version has been deployed on Vercel.
export async function GET() {
    const buildId = process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || '__dev__';
    
    return NextResponse.json(
        { buildId, timestamp: Date.now() },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
            }
        }
    );
}
