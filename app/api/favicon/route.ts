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

        console.log('Favicon constant found:', faviconConstant?.description, '- Image:', faviconConstant?.image?.substring(0, 50));

        if (faviconConstant?.image) {
            const imageUrl = faviconConstant.image;

            // If the image is a data URL, extract and return as image
            if (imageUrl.startsWith('data:')) {
                const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const contentType = matches[1];
                    const base64Data = matches[2];
                    const buffer = Buffer.from(base64Data, 'base64');

                    return new NextResponse(buffer, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            }

            // If it's an external URL, fetch and return the image
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                try {
                    const imageResponse = await fetch(imageUrl);
                    if (imageResponse.ok) {
                        const imageBuffer = await imageResponse.arrayBuffer();
                        const contentType = imageResponse.headers.get('content-type') || 'image/png';

                        return new NextResponse(Buffer.from(imageBuffer), {
                            headers: {
                                'Content-Type': contentType,
                                'Cache-Control': 'public, max-age=3600',
                            },
                        });
                    }
                } catch (fetchError) {
                    console.error('Error fetching external favicon:', fetchError);
                }
            }

            // If it's a relative URL, redirect to it
            if (imageUrl.startsWith('/')) {
                return NextResponse.redirect(new URL(imageUrl, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
            }
        }

        // Fallback to default favicon
        return NextResponse.redirect(new URL('/devco-logo-v3.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    } catch (error) {
        console.error('Favicon fetch error:', error);
        // Fallback to default
        return NextResponse.redirect(new URL('/devco-logo-v3.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
}
