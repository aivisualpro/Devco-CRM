import { NextResponse } from 'next/server';
import { QBO_CLIENT_ID, QBO_CLIENT_SECRET } from '@/lib/quickbooks';

export async function GET(req: Request) {
    if (!QBO_CLIENT_ID) {
        return NextResponse.json({ error: 'QBO_CLIENT_ID is not configured' }, { status: 500 });
    }

    const { origin } = new URL(req.url);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const redirectUri = `${appUrl}/api/auth/quickbooks/callback`;
    const scope = 'com.intuit.quickbooks.accounting';
    const state = 'devco_qbo_auth'; 

    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${QBO_CLIENT_ID}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.redirect(authUrl);
}
