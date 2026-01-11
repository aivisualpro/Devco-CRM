import { NextRequest, NextResponse } from 'next/server';
import { processGoogleDoc } from '@/lib/googleService';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { templateId, variables } = body;

        if (!templateId) {
            return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
        }

        const pdfBuffer = await processGoogleDoc(templateId, variables || {});

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="generated_proposal.pdf"'
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
