import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Token from '@/lib/models/Token';
import { QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REALM_ID } from '@/lib/quickbooks';

export async function GET(req: NextRequest) {
    const { searchParams, origin } = new URL(req.url);
    // Force https and remove trailing slash for exact matching
    let appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    appUrl = appUrl.replace(/\/$/, '').replace(/^http:/, 'https:');
    
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${appUrl}/settings/imports?error=${error}`);
    }

    if (!code) {
        return NextResponse.redirect(`${appUrl}/settings/imports?error=no_code`);
    }

    try {
        const redirectUri = `${appUrl}/api/auth/quickbooks/callback`;
        const auth = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');
        const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

        console.log('Exchanging code for tokens with Redirect URI:', redirectUri);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('QBO Token Exchange Failed:', errorData);
            return NextResponse.redirect(`${appUrl}/settings/imports?error=token_exchange_failed`);
        }

        const data = await response.json();

        await connectToDatabase();
        await Token.findOneAndUpdate(
            { service: 'quickbooks' },
            { 
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                realmId: realmId || QBO_REALM_ID,
                expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
                refreshTokenExpiresAt: new Date(Date.now() + (data.x_refresh_token_expires_in * 1000))
            },
            { upsert: true, new: true }
        );

        return NextResponse.redirect(`${appUrl}/settings/imports?success=quickbooks_connected`);
    } catch (err) {
        console.error('QuickBooks Auth Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/settings/imports?error=internal_error`);
    }
}
