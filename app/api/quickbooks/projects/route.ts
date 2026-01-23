import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';

export async function GET() {
    try {
        await connectToDatabase();
        
        console.log('Fetching QuickBooks projects from MongoDB...');
        
        // Fetch projects from MongoDB and sort by newest first
        const projects = await DevcoQuickBooks.find({}).sort({ createdAt: -1 });

        // Map MongoDB projects to the format expected by the UI
        const formattedProjects = projects.map(p => {
            const transactions = (p as any).transactions || [];
            let income = 0;
            let cost = 0;

            transactions.forEach((t: any) => {
                const amount = t.amount || 0;
                if (t.transactionType?.toLowerCase() === 'invoice') {
                    income += amount;
                } else {
                    cost += amount;
                }
            });

            return {
                Id: p.projectId,
                DisplayName: p.project,
                CompanyName: p.customer,
                FullyQualifiedName: `${p.customer}:${p.project}`,
                MetaData: { CreateTime: p.startDate || p.createdAt },
                income,
                cost,
                profitMargin: income > 0 ? Math.round(((income - cost) / income) * 100) : 0,
                status: p.status,
                proposalNumber: p.proposalNumber,
                startDate: p.startDate,
                endDate: p.endDate,
                Active: true,
                CurrencyRef: { value: 'USD' },
                Balance: 0
            };
        });

        console.log(`Found ${formattedProjects.length} projects in MongoDB`);
        return NextResponse.json(formattedProjects);
    } catch (error: any) {
        console.error('Error fetching QuickBooks projects from MongoDB:', error);
        return NextResponse.json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
