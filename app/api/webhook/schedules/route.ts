import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule } from '@/lib/models';

/**
 * Webhook endpoint for AppSheet to add/update schedules
 * 
 * URL: /api/webhook/schedules
 * 
 * Expected POST body (from AppSheet):
 * {
 *   "action": "add" | "update" | "delete",
 *   "Record_ID": "string",           // MongoDB _id
 *   "Title": "string",
 *   "From": "YYYY-MM-DD" or "MM/DD/YYYY",
 *   "To": "YYYY-MM-DD" or "MM/DD/YYYY",
 *   "Customer": "string",            // customerId
 *   "Proposal Number": "string",     // estimate
 *   "Project Manager Name": "string",// projectManager email
 *   "Foreman Name": "string",        // foremanName email
 *   "Assignees": "email1 , email2",  // comma-separated
 *   "Description": "string",         // description/scope
 *   "Service Item": "string",        // service
 *   "Color": "string",               // item/tag
 *   "Labor Agreement": "string",     // fringe
 *   "Certified Payroll": "string",
 *   "Notify Assignees": "Yes" | "No",
 *   "Per Diem": "Yes" | "No",
 *   "Aerial Image": "string",        // URL
 *   "Site Layout": "string",         // URL
 *   "todayObjectives": "obj1 , obj2" // comma-separated
 * }
 */

// Helper to parse date in various formats
function parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    
    // Try YYYY-MM-DD format first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Try MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [month, day, year] = parts;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) return date;
    }
    
    return null;
}

// Helper to parse assignees from "email1 , email2" format
function parseAssignees(assigneesStr: string | undefined): string[] {
    if (!assigneesStr) return [];
    return assigneesStr.split(',').map(a => a.trim()).filter(Boolean);
}

// Helper to parse today objectives from "obj1 , obj2" format
function parseObjectives(objectivesStr: string | undefined): { text: string; completed: boolean }[] {
    if (!objectivesStr) return [];
    return objectivesStr.split(',').map(o => o.trim()).filter(Boolean).map(text => ({
        text,
        completed: false
    }));
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Support both single record and array of records
        const records = Array.isArray(body) ? body : [body];
        
        await connectToDatabase();
        
        const results: any[] = [];
        
        for (const record of records) {
            const action = (record.action || 'update').toLowerCase();
            const recordId = record.Record_ID || record._id || record.recordId;
            
            if (!recordId && action !== 'add') {
                results.push({ error: 'Record_ID is required for update/delete', record });
                continue;
            }
            
            // Map AppSheet fields to MongoDB fields
            const scheduleData: any = {};
            
            // Only set fields that are provided (allows partial updates)
            if (record.Title !== undefined) scheduleData.title = record.Title;
            if (record.From !== undefined) {
                const fromDate = parseDate(record.From);
                if (fromDate) scheduleData.fromDate = fromDate;
            }
            if (record.To !== undefined) {
                const toDate = parseDate(record.To);
                if (toDate) scheduleData.toDate = toDate;
            }
            if (record.Customer !== undefined) scheduleData.customerId = record.Customer;
            if (record['Proposal Number'] !== undefined) scheduleData.estimate = record['Proposal Number'];
            if (record['Project Manager Name'] !== undefined) scheduleData.projectManager = record['Project Manager Name'];
            if (record['Foreman Name'] !== undefined) scheduleData.foremanName = record['Foreman Name'];
            if (record.Assignees !== undefined) scheduleData.assignees = parseAssignees(record.Assignees);
            if (record.Description !== undefined) scheduleData.description = record.Description;
            if (record['Service Item'] !== undefined) scheduleData.service = record['Service Item'];
            if (record.Color !== undefined) scheduleData.item = record.Color;
            if (record['Labor Agreement'] !== undefined) scheduleData.fringe = record['Labor Agreement'];
            if (record['Certified Payroll'] !== undefined) scheduleData.certifiedPayroll = record['Certified Payroll'];
            if (record['Notify Assignees'] !== undefined) scheduleData.notifyAssignees = record['Notify Assignees'];
            if (record['Per Diem'] !== undefined) scheduleData.perDiem = record['Per Diem'];
            if (record['Aerial Image'] !== undefined) scheduleData.aerialImage = record['Aerial Image'];
            if (record['Site Layout'] !== undefined) scheduleData.siteLayout = record['Site Layout'];
            if (record.todayObjectives !== undefined) scheduleData.todayObjectives = parseObjectives(record.todayObjectives);
            
            // Handle different actions
            switch (action) {
                case 'add':
                case 'create': {
                    // Generate new ID if not provided
                    const newId = recordId || Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                    
                    const doc = new Schedule({
                        _id: newId,
                        ...scheduleData,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    await doc.save();
                    
                    results.push({ 
                        success: true, 
                        action: 'created', 
                        _id: doc._id,
                        record 
                    });
                    break;
                }
                
                case 'update':
                case 'edit': {
                    const updated = await Schedule.findByIdAndUpdate(
                        recordId,
                        { 
                            ...scheduleData, 
                            updatedAt: new Date() 
                        },
                        { new: true, upsert: true } // upsert: create if not exists
                    );
                    
                    results.push({ 
                        success: true, 
                        action: updated ? 'updated' : 'created', 
                        _id: recordId,
                        record 
                    });
                    break;
                }
                
                case 'delete': {
                    await Schedule.findByIdAndDelete(recordId);
                    results.push({ 
                        success: true, 
                        action: 'deleted', 
                        _id: recordId 
                    });
                    break;
                }
                
                default:
                    results.push({ 
                        error: `Unknown action: ${action}`, 
                        record 
                    });
            }
        }
        
        return NextResponse.json({ 
            success: true, 
            processed: results.length,
            results 
        });
        
    } catch (error: any) {
        console.error('[Webhook Schedules] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message }, 
            { status: 500 }
        );
    }
}

// Support GET for testing/health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: '/api/webhook/schedules',
        description: 'Webhook endpoint for AppSheet to add/update/delete schedules',
        methods: ['POST', 'GET'],
        expectedFields: {
            action: 'add | update | delete (default: update)',
            Record_ID: 'MongoDB _id (required for update/delete)',
            Title: 'Schedule title',
            From: 'From date (YYYY-MM-DD or MM/DD/YYYY)',
            To: 'To date (YYYY-MM-DD or MM/DD/YYYY)',
            Customer: 'Customer ID',
            'Proposal Number': 'Estimate/Proposal number',
            'Project Manager Name': 'PM email',
            'Foreman Name': 'Foreman email',
            Assignees: 'Comma-separated emails (email1 , email2)',
            Description: 'Scope of work',
            'Service Item': 'Service type',
            Color: 'Tag/Item (e.g., Day Off)',
            'Labor Agreement': 'Fringe',
            'Certified Payroll': 'Yes/No',
            'Notify Assignees': 'Yes/No',
            'Per Diem': 'Yes/No',
            'Aerial Image': 'Image URL',
            'Site Layout': 'Site layout URL',
            todayObjectives: 'Comma-separated objectives'
        }
    });
}
