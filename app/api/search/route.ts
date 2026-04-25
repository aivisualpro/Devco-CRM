import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client, Employee, Estimate, Schedule } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

const ALLOWED_TYPES = ['clients', 'employees', 'estimates', 'schedules'];

export async function GET(req: NextRequest) {
    console.time('Search API Total');
    const startTime = performance.now();
    
    try {
        // 1. Auth required
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        
        const searchParams = req.nextUrl.searchParams;
        const q = searchParams.get('q');
        const typesParam = searchParams.get('types');
        const limitParam = searchParams.get('limit');
        
        // 2. Query validation
        if (!q || q.trim().length < 2) {
            return NextResponse.json({ success: false, error: 'Query parameter "q" must be at least 2 characters long.' }, { status: 400 });
        }
        const queryTerm = q.trim();
        
        // 3. Types filter
        let types = ALLOWED_TYPES;
        if (typesParam) {
            const requestedTypes = typesParam.split(',').map(t => t.trim().toLowerCase());
            types = requestedTypes.filter(t => ALLOWED_TYPES.includes(t));
            if (types.length === 0) types = ALLOWED_TYPES;
        }
        
        // 4. Limit parsing
        let limit = 10;
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = Math.min(parsedLimit, 20);
            }
        }
        
        // 5. Short queries use regex, others use $text
        const useRegex = queryTerm.length < 3;
        
        const results: Record<string, any[]> = {};
        ALLOWED_TYPES.forEach(t => results[t] = []); // Initialize all keys
        
        const timing: Record<string, number> = {};
        
        const searchPromises = types.map(async (type) => {
            console.time(`Search API Type - ${type}`);
            const typeStartTime = performance.now();
            let items: any[] = [];
            
            try {
                let model: any;
                let regexFields: string[] = [];
                let selectFields: any = {};
                
                switch (type) {
                    case 'clients':
                        model = Client;
                        regexFields = ['name', 'contacts.email', 'businessEmail'];
                        selectFields = { name: 1, businessEmail: 1, status: 1, 'contacts.email': 1 };
                        break;
                    case 'employees':
                        model = Employee;
                        regexFields = ['firstName', 'lastName', 'email'];
                        selectFields = { firstName: 1, lastName: 1, email: 1, appRole: 1, companyPosition: 1, profilePicture: 1 };
                        break;
                    case 'estimates':
                        model = Estimate;
                        regexFields = ['projectName', 'projectTitle', 'notes', 'estimate'];
                        selectFields = { projectName: 1, projectTitle: 1, estimate: 1, status: 1, customerName: 1 };
                        break;
                    case 'schedules':
                        model = Schedule;
                        regexFields = ['title', 'description', 'estimate'];
                        selectFields = { title: 1, description: 1, status: 1, fromDate: 1, toDate: 1, customerName: 1 };
                        break;
                }
                
                if (model) {
                    if (useRegex) {
                        const regex = { $regex: queryTerm, $options: 'i' };
                        const orConditions = regexFields.map(field => ({ [field]: regex }));
                        
                        items = await model.find({ $or: orConditions }, selectFields)
                            .limit(limit)
                            .lean();
                    } else {
                        // $text with textScore projection + sort
                        const projection = { ...selectFields, score: { $meta: "textScore" } };
                        const sort = { score: { $meta: "textScore" } as any };
                        
                        items = await model.find({ $text: { $search: queryTerm } }, projection)
                            .sort(sort)
                            .limit(limit)
                            .lean();
                    }
                }
            } catch (err: any) {
                console.error(`[Search API] Error searching ${type}:`, err);
            }
            
            results[type] = items;
            timing[type] = performance.now() - typeStartTime;
            console.timeEnd(`Search API Type - ${type}`);
        });
        
        await Promise.all(searchPromises);
        
        const totalMs = performance.now() - startTime;
        console.timeEnd('Search API Total');
        
        return NextResponse.json({
            q: queryTerm,
            types,
            results,
            timing: {
                totalMs,
                perType: timing
            }
        });
        
    } catch (error: any) {
        console.error('[Search API] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
