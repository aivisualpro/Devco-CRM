import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Constant from '@/lib/models/Constant';

export async function GET() {
    try {
        await connectToDatabase();

        // Find the SITE Favicon constant (case-insensitive search)
        const faviconConstant = await Constant.findOne({
            $or: [
                { description: { $regex: /^site\s*favicon$/i } },
                { description: 'SITE Favicon' },
                { description: 'Site Favicon' }
            ]
        }).lean();

        if (faviconConstant?.image) {
            // If the image is a data URL, extract and return as image
            if (faviconConstant.image.startsWith('data:')) {
                const matches = faviconConstant.image.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const contentType = matches[1];
                    const base64Data = matches[2];
                    const buffer = Buffer.from(base64Data, 'base64');

                    return new NextResponse(buffer, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                        },
                    });
                }
            }

            // If it's a URL, redirect to it
            return NextResponse.redirect(faviconConstant.image);
        }

        // Fallback to default favicon
        return NextResponse.redirect(new URL('/devco-logo-v3.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    } catch (error) {
        console.error('Favicon fetch error:', error);
        // Fallback to default
        return NextResponse.redirect(new URL('/devco-logo-v3.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
}
