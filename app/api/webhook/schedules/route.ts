import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Employee } from '@/lib/models';
import { sendSMS } from '@/lib/signalwire';

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
            // Support both AppSheet keys (Capitalized/Spaced) and direct Schema keys (camelCase)
            
            const getVal = (keys: string[]) => {
                for (const k of keys) {
                    if (record[k] !== undefined) return record[k];
                }
                return undefined;
            };

            const title = getVal(['Title', 'title']);
            if (title !== undefined) scheduleData.title = title;

            const fromVal = getVal(['From', 'fromDate']);
            if (fromVal !== undefined) {
                const fromDate = parseDate(fromVal);
                if (fromDate) scheduleData.fromDate = fromDate;
            }

            const toVal = getVal(['To', 'toDate']);
            if (toVal !== undefined) {
                const toDate = parseDate(toVal);
                if (toDate) scheduleData.toDate = toDate;
            }

            const customerId = getVal(['Customer', 'customerId']);
            if (customerId !== undefined) scheduleData.customerId = customerId;

            const estimate = getVal(['Proposal Number', 'estimate']);
            if (estimate !== undefined) scheduleData.estimate = estimate;

            const pmName = getVal(['Project Manager Name', 'projectManager']);
            if (pmName !== undefined) scheduleData.projectManager = pmName;

            const foreman = getVal(['Foreman Name', 'foremanName']);
            if (foreman !== undefined) scheduleData.foremanName = foreman;

            const assigneesVal = getVal(['Assignees', 'assignees']);
            if (assigneesVal !== undefined) {
                // If it's already an array, use it. If string, parse it.
                if (Array.isArray(assigneesVal)) {
                    scheduleData.assignees = assigneesVal;
                } else {
                    scheduleData.assignees = parseAssignees(String(assigneesVal));
                }
            }

            const description = getVal(['Description', 'description']);
            if (description !== undefined) scheduleData.description = description;

            const service = getVal(['Service Item', 'service']);
            if (service !== undefined) scheduleData.service = service;

            const item = getVal(['Color', 'item']);
            if (item !== undefined) scheduleData.item = item;

            const fringe = getVal(['Labor Agreement', 'fringe']);
            if (fringe !== undefined) scheduleData.fringe = fringe;

            const certPayroll = getVal(['Certified Payroll', 'certifiedPayroll']);
            if (certPayroll !== undefined) scheduleData.certifiedPayroll = certPayroll;

            const notify = getVal(['Notify Assignees', 'notifyAssignees']);
            if (notify !== undefined) scheduleData.notifyAssignees = notify;

            const perDiem = getVal(['Per Diem', 'perDiem']);
            if (perDiem !== undefined) scheduleData.perDiem = perDiem;

            const aerial = getVal(['Aerial Image', 'aerialImage']);
            if (aerial !== undefined) scheduleData.aerialImage = aerial;

            const site = getVal(['Site Layout', 'siteLayout']);
            if (site !== undefined) scheduleData.siteLayout = site;

            const objectives = getVal(['todayObjectives']);
            if (objectives !== undefined) {
                if (Array.isArray(objectives)) {
                    scheduleData.todayObjectives = objectives; // Assuming already in correct format if array
                } else {
                    scheduleData.todayObjectives = parseObjectives(String(objectives));
                }
            }
            
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
                    
                    const docAny = doc as any;
                    if (docAny.notifyAssignees === true || docAny.notifyAssignees === 'Yes' || docAny.notifyAssignees === 'true') {
                        if (Array.isArray(docAny.assignees) && docAny.assignees.length > 0) {
                            const fmtDate = docAny.fromDate ? new Date(docAny.fromDate).toLocaleDateString() : 'N/A';
                            const messageBody = `You have been assigned to a new devco schedule: ${docAny.title || docAny.jobLocation || 'Job Schedule'}. Date: ${fmtDate}`;
                            
                            try {
                                const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();
                                const smsPromises = assigneesDocs
                                    .map(emp => emp.phone || emp.mobile)
                                    .filter(Boolean)
                                    .map(phone => sendSMS(phone!, messageBody).catch(err => console.error('[SMS] Failed for', phone, err)));
                                await Promise.all(smsPromises);
                            } catch (smsErr) {
                                console.error('[SMS] Error sending notifications:', smsErr);
                            }
                        }
                    }

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
