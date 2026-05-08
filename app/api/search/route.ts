import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client, Employee, Estimate, Schedule } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { atlasSearch, AtlasSearchField } from '@/lib/atlasSearch';

const ALLOWED_TYPES = ['clients', 'employees', 'estimates', 'schedules'];

/**
 * Search field definitions per entity type.
 * Boost values control relevance ranking (higher = more important).
 */
const SEARCH_CONFIGS: Record<string, {
    model: any;
    fields: AtlasSearchField[];
    project: Record<string, any>;
}> = {
    clients: {
        model: Client,
        fields: [
            { path: 'name', boost: 5 },
            { path: 'contacts.email', boost: 2 },
            { path: 'businessEmail', boost: 2 },
            { path: 'contacts.name', boost: 3 },
        ],
        project: { name: 1, businessEmail: 1, status: 1, 'contacts.email': 1 },
    },
    employees: {
        model: Employee,
        fields: [
            { path: 'firstName', boost: 5 },
            { path: 'lastName', boost: 5 },
            { path: 'email', boost: 3 },
        ],
        project: { firstName: 1, lastName: 1, email: 1, appRole: 1, companyPosition: 1, profilePicture: 1 },
    },
    estimates: {
        model: Estimate,
        fields: [
            { path: 'estimate', boost: 5 },
            { path: 'projectName', boost: 3 },
            { path: 'projectTitle', boost: 3 },
            { path: 'customerName', boost: 3 },
        ],
        project: { projectName: 1, projectTitle: 1, estimate: 1, status: 1, customerName: 1 },
    },
    schedules: {
        model: Schedule,
        fields: [
            { path: 'title', boost: 4 },
            { path: 'estimate', boost: 3 },
            { path: 'customerName', boost: 3 },
            { path: 'description', boost: 1 },
        ],
        project: { title: 1, description: 1, status: 1, fromDate: 1, toDate: 1, customerName: 1 },
    },
};

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
        
        const results: Record<string, any[]> = {};
        ALLOWED_TYPES.forEach(t => results[t] = []); // Initialize all keys
        
        const timing: Record<string, number> = {};
        let anyUsedAtlas = false;
        
        const searchPromises = types.map(async (type) => {
            console.time(`Search API Type - ${type}`);
            const typeStartTime = performance.now();
            
            try {
                const config = SEARCH_CONFIGS[type];
                if (config) {
                    const { items, usedAtlasSearch } = await atlasSearch({
                        model: config.model,
                        query: queryTerm,
                        fields: config.fields,
                        project: config.project,
                        limit,
                        fuzzyMaxEdits: 1,
                    });
                    results[type] = items;
                    if (usedAtlasSearch) anyUsedAtlas = true;
                }
            } catch (err: any) {
                console.error(`[Search API] Error searching ${type}:`, err);
            }
            
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
            engine: anyUsedAtlas ? 'atlas' : 'regex',
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
