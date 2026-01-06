
import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/quickbooks';

export async function GET() {
    try {
        console.log('Fetching QuickBooks projects...');
        const projects = await getProjects();
        console.log(`Found ${projects.length} projects`);
        return NextResponse.json(projects);
    } catch (error: any) {
        console.error('Detailed QuickBooks API Error:', error);
        return NextResponse.json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
