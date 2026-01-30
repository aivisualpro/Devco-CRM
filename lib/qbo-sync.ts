import { DevcoQuickBooks } from '@/lib/models';
import { getSingleProject, qboQuery } from '@/lib/quickbooks';
import { connectToDatabase } from '@/lib/db';

export async function syncProjectToDb(projectId: string) {
    await connectToDatabase();
    
    console.log(`[QBO-SYNC] Syncing project ${projectId} to MongoDB...`);
    
    // 1. Fetch live data from QBO
    // This function automatically fetches Customer details + Profitability + Transactions (via Reports)
    const lp = await getSingleProject(projectId);
    
    // 2. Prepare update data
    const updateData = {
        project: lp.project || lp.DisplayName,
        customer: lp.customer || lp.CompanyName || lp.FullyQualifiedName.split(':')[0],
        startDate: lp.MetaData?.CreateTime ? new Date(lp.MetaData.CreateTime) : undefined,
        status: lp.status,
        transactions: (lp.transactions || []).map((t: any) => ({
            transactionId: t.id,
            date: t.date ? new Date(t.date) : new Date(),
            transactionType: t.type,
            split: '', 
            fromTo: t.from,
            projectId: lp.Id,
            amount: t.amount,
            memo: t.memo
        }))
    };
    
    // 3. Extract Proposal Number
    const projectName = lp.project || lp.DisplayName || '';
    const proposalMatch = projectName.match(/^([^_]+)_/);
    const extractedProposalNumber = proposalMatch ? proposalMatch[1].trim() : undefined;
    
    // 4. Update DB
    const existingProject = await DevcoQuickBooks.findOne({ projectId: lp.Id });
    
    const finalUpdateData: any = { ...updateData };
    
    // Only update proposalNumber if it's a new project or current proposalNumber is empty
    if (extractedProposalNumber && (!existingProject || !existingProject.proposalNumber)) {
        finalUpdateData.proposalNumber = extractedProposalNumber;
    }
    
    await DevcoQuickBooks.findOneAndUpdate(
        { projectId: lp.Id },
        { $set: finalUpdateData },
        { upsert: true, new: true, runValidators: true }
    );
    
    console.log(`[QBO-SYNC] Successfully synced project ${projectId}`);
    return lp;
}

export async function resolveProjectIdsFromEntity(entityName: string, entityId: string): Promise<string[]> {
    try {
        // 1. Direct Project/Customer updates
        if (entityName === 'Customer') {
            // Check if it's a project (Job=true or IsProject=true)
            // Querying it to be safe, though Webhook implies it's a Customer entity
            const res = await qboQuery(`SELECT Id, Job, IsProject, ParentRef FROM Customer WHERE Id = '${entityId}'`);
            const customer = res.QueryResponse?.Customer?.[0];
            
            if (!customer) return [];
            
            // If it is a project itself
            if (customer.Job === true || customer.IsProject === true) {
                return [customer.Id];
            }
            
            // If it's a parent customer, maybe we should sync all child projects? 
            // For now, let's just ignore root customers unless they are treated as projects.
            return [];
        }

        // 2. Transaction updates (Invoice, Estimate, Payment)
        // These usually have a direct CustomerRef
        if (['Invoice', 'Estimate', 'Payment', 'SalesReceipt', 'CreditMemo'].includes(entityName)) {
            const res = await qboQuery(`SELECT CustomerRef FROM ${entityName} WHERE Id = '${entityId}'`);
            const txn = res.QueryResponse?.[entityName]?.[0];
            const customerId = txn?.CustomerRef?.value;
            
            if (customerId) {
                // Verify if this Customer is actually a Project we care about
                // We'll return it, and syncProjectToDb will handle/fail if it's not a valid Project
                // Or we could check IsProject here. Let's return it to be aggressive in syncing.
                return [customerId];
            }
        }
        
        // 3. Bills / Purchases (Expenses) / Journal Entries
        // These are harder because they can be split across multiple customers (projects) via Lines
        if (['Bill', 'Purchase', 'JournalEntry', 'VendorCredit', 'CreditCardCredit'].includes(entityName)) {
            const res = await qboQuery(`SELECT Line FROM ${entityName} WHERE Id = '${entityId}'`);
            const txn = res.QueryResponse?.[entityName]?.[0];
            
            const projectIds = new Set<string>();
            
            if (txn && txn.Line) {
                txn.Line.forEach((line: any) => {
                    // Check various places where CustomerRef might hide in a Line
                    const details = line.AccountBasedExpenseLineDetail || 
                                    line.ItemBasedExpenseLineDetail || 
                                    line.JournalEntryLineDetail || 
                                    line.SalesItemLineDetail;
                                    
                    if (details) {
                        // Sometimes it's directly in details.CustomerRef
                        if (details.CustomerRef?.value) {
                            projectIds.add(details.CustomerRef.value);
                        }
                        // For Journal Entries, it might be in Entity (Name)
                        if (details.Entity?.EntityRef?.value && details.Entity?.EntityRef?.type === 'Customer') {
                            projectIds.add(details.Entity.EntityRef.value);
                        }
                    }
                });
            }
            
            return Array.from(projectIds);
        }

        return [];
    } catch (error) {
        console.error(`[QBO-SYNC] Error resolving project for ${entityName} ${entityId}:`, error);
        return [];
    }
}
