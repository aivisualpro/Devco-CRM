
const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const QBO_REALM_ID = process.env.QBO_REALM_ID;
// We'll update this in memory, so use let or access process.env directly
let QBO_REFRESH_TOKEN = process.env.QBO_REFRESH_TOKEN;

import fs from 'fs';
import path from 'path';

// Determine if we are in production or development
const IS_PRODUCTION = process.env.QBO_IS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
const BASE_URL = IS_PRODUCTION 
    ? 'https://quickbooks.api.intuit.com' 
    : 'https://sandbox-quickbooks.api.intuit.com';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function getAccessToken() {
    if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET || !QBO_REFRESH_TOKEN) {
        throw new Error('QuickBooks credentials missing in environment variables');
    }

    // Log which credentials we are using (masking secrets)
    console.log('Refreshing QuickBooks token...');
    console.log(`Using Client ID: ${QBO_CLIENT_ID.substring(0, 5)}...`);
    console.log(`Using Refresh Token: ${QBO_REFRESH_TOKEN.substring(0, 10)}...`);

    const auth = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: QBO_REFRESH_TOKEN.trim(), // Trim in case of accidental whitespace
        }).toString(),
    });

    if (!response.ok) {
        let errorData: any = {};
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: 'Could not parse error response', details: await response.text() };
        }
        console.error('Failed to refresh QuickBooks token:', JSON.stringify(errorData, null, 2));
        throw new Error(`QuickBooks Token Refresh Failed: ${errorData.error_description || errorData.error || response.statusText}`);
    }

    const data = await response.json();

    // AUTO-REFRESH LOGIC: Update the token for next time
    if (data.refresh_token) {
        console.log('Received new Refresh Token. Persisting to storage...');
        
        // 1. Update in-memory for current process
        process.env.QBO_REFRESH_TOKEN = data.refresh_token; 
        QBO_REFRESH_TOKEN = data.refresh_token;

        // 2. Persist to .env.local for development/local persistence
        try {
            const envPath = path.resolve(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                const regex = /^QBO_REFRESH_TOKEN=.*$/m;
                
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `QBO_REFRESH_TOKEN=${data.refresh_token}`);
                } else {
                    envContent += `\nQBO_REFRESH_TOKEN=${data.refresh_token}`;
                }
                
                fs.writeFileSync(envPath, envContent);
                console.log('Successfully updated .env.local with new refresh token.');
            }
        } catch (filesysError) {
            console.error('Failed to write new token to .env.local:', filesysError);
            // Non-fatal, app continues working until restart
        }
    }

    return data.access_token;
}

export async function qboQuery(query: string) {
    try {
        if (!QBO_REALM_ID) {
            throw new Error('QBO_REALM_ID is missing in environment variables');
        }

        const accessToken = await getAccessToken();
        const url = `${BASE_URL}/v3/company/${QBO_REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=70`;

        console.log(`QBO Environment: ${IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'}`);
        console.log(`QBO Full URL: ${url}`);
        console.log(`QBO Query Request: ${query}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                // Removed Content-Type for GET query to avoid potential issues
            },
        });

        if (!response.ok) {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {}
            console.error(`QuickBooks API Error (${response.status}):`, errorText);
            throw new Error(`QuickBooks API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Safety check for response structure
        if (!data || !data.QueryResponse) {
            console.warn('QuickBooks returned unexpected response structure:', data);
            return { QueryResponse: {} };
        }

        return data;
    } catch (error: any) {
        console.error('qboQuery Error:', error.message);
        throw error;
    }
}

export async function getProjects() {
    // Sometimes 'IsProject' is not indexable/queryable directly in some QBO versions
    // We fetch customers and filter in memory to be safe, or try the Job=true filter
    try {
        console.log('Attempting to fetch projects via Customer query...');
        // Try the most broadly supported query first
        const query = "SELECT * FROM Customer MAXRESULTS 1000";
        const data = await qboQuery(query);
        const customers = data?.QueryResponse?.Customer || [];
        
        // Filter for projects (IsProject: true) or Jobs (Job: true)
        // Filter for projects (IsProject: true) or Jobs (Job: true)
        const projects = customers.filter((c: any) => c.IsProject === true || c.Job === true);
        
        console.log(`Successfully filtered ${projects.length} projects from ${customers.length} customers. Fetching financial data...`);

        // Fetch financial data: Invoices for Income, Purchases/Bills for Costs
        try {
            // Fetch all invoices (limit 1000 for performance)
            const invoiceQuery = "SELECT * FROM Invoice MAXRESULTS 1000";
            const invoiceData = await qboQuery(invoiceQuery);
            const invoices = invoiceData?.QueryResponse?.Invoice || [];
            
            // Create a map of Customer ID -> Total Invoice Amount (Income)
            const customerIncome = new Map<string, number>();
            invoices.forEach((inv: any) => {
                const customerId = inv.CustomerRef?.value;
                if (customerId) {
                    const current = customerIncome.get(customerId) || 0;
                    customerIncome.set(customerId, current + (inv.TotalAmt || 0));
                }
            });
            
            console.log(`Processed ${invoices.length} invoices for ${customerIncome.size} unique customers.`);
            
            // Fetch all Purchases (expenses linked to customers)
            // In QBO, "Purchase" includes Cash/Check Expenses, Credit Card Expenses
            const purchaseQuery = "SELECT * FROM Purchase MAXRESULTS 1000";
            const purchaseData = await qboQuery(purchaseQuery).catch(() => ({ QueryResponse: {} }));
            const purchases = purchaseData?.QueryResponse?.Purchase || [];
            
            // Create a map of Customer ID -> Total Cost
            const customerCosts = new Map<string, number>();
            
            // Process Purchases
            purchases.forEach((purchase: any) => {
                // Purchases can have CustomerRef at the header level OR in line items
                // Check header-level customer first
                let customerId = purchase.EntityRef?.value; // The entity (customer/vendor) involved
                
                // If it's a customer-linked expense, the CustomerRef might be in Line items
                if (purchase.Line) {
                    purchase.Line.forEach((line: any) => {
                        const lineCustomerId = line.AccountBasedExpenseLineDetail?.CustomerRef?.value ||
                                               line.ItemBasedExpenseLineDetail?.CustomerRef?.value;
                        if (lineCustomerId) {
                            const current = customerCosts.get(lineCustomerId) || 0;
                            customerCosts.set(lineCustomerId, current + (line.Amount || 0));
                        }
                    });
                }
            });
            
            // Also fetch Bills (vendor bills that may have customer-linked line items)
            const billQuery = "SELECT * FROM Bill MAXRESULTS 1000";
            const billData = await qboQuery(billQuery).catch(() => ({ QueryResponse: {} }));
            const bills = billData?.QueryResponse?.Bill || [];
            
            // Process Bills - look for customer in line items
            bills.forEach((bill: any) => {
                if (bill.Line) {
                    bill.Line.forEach((line: any) => {
                        const lineCustomerId = line.AccountBasedExpenseLineDetail?.CustomerRef?.value ||
                                               line.ItemBasedExpenseLineDetail?.CustomerRef?.value;
                        if (lineCustomerId) {
                            const current = customerCosts.get(lineCustomerId) || 0;
                            customerCosts.set(lineCustomerId, current + (line.Amount || 0));
                        }
                    });
                }
            });
            
            console.log(`Processed ${purchases.length} purchases and ${bills.length} bills. Found costs for ${customerCosts.size} customers.`);
            
            // Merge income and costs into projects
            let matchedCount = 0;
            projects.forEach((p: any) => {
                const income = customerIncome.get(p.Id) || 0;
                const cost = customerCosts.get(p.Id) || 0;
                
                if (income > 0 || cost > 0) {
                    p.income = income;
                    p.cost = cost;
                    p.profitMargin = income > 0 ? parseFloat((((income - cost) / income) * 100).toFixed(1)) : 0;
                    matchedCount++;
                }
            });
            
            console.log(`Matched ${matchedCount} projects with financial data out of ${projects.length} total.`);
            
        } catch (invoiceErr) {
            console.warn('Failed to fetch/parse financial data:', invoiceErr);
        }

        return projects;
    } catch (error) {
        console.error('Error in getProjects:', error);
        throw error;
    }
}

export async function getAllCustomers() {
    const query = "SELECT * FROM Customer MAXRESULTS 1000";
    const data = await qboQuery(query);
    return data.QueryResponse.Customer || [];
}
export async function getProjectTransactions(projectId: string) {
    try {
        console.log(`Fetching transactions for project/customer ID: ${projectId}...`);
        
        // We'll query multiple transaction types that commonly affect a project
        // Note: In a production app, we'd probably use the 'General Ledger' or 'Transaction List' report API
        // but for a simple list, querying Invoice and Purchase is a good start.
        
        const invoiceQuery = `SELECT * FROM Invoice WHERE CustomerRef = '${projectId}' MAXRESULTS 100`;
        const paymentQuery = `SELECT * FROM Payment WHERE CustomerRef = '${projectId}' MAXRESULTS 100`;
        const billQuery = `SELECT * FROM Bill MAXRESULTS 50`; // Limit to latest bills and filter in memory
        
        const [invoicesData, paymentsData, billsData] = await Promise.all([
            qboQuery(invoiceQuery).catch(() => ({ QueryResponse: {} })),
            qboQuery(paymentQuery).catch(() => ({ QueryResponse: {} })),
            qboQuery(billQuery).catch(() => ({ QueryResponse: {} }))
        ]);

        const invoices = (invoicesData?.QueryResponse?.Invoice || []).map((inv: any) => ({
            id: inv.Id,
            date: inv.TxnDate,
            type: 'Invoice',
            no: inv.DocNumber,
            from: inv.CustomerRef?.name || '---',
            memo: inv.PrivateNote || inv.CustomerMemo?.value || '',
            amount: inv.TotalAmt,
            status: inv.Balance === 0 ? 'Paid' : (new Date(inv.DueDate) < new Date() ? 'Overdue' : 'Open'),
            statusColor: inv.Balance === 0 ? 'emerald' : 'amber'
        }));

        const payments = (paymentsData?.QueryResponse?.Payment || []).map((pay: any) => ({
            id: pay.Id,
            date: pay.TxnDate,
            type: 'Payment',
            no: pay.DocNumber || '',
            from: pay.CustomerRef?.name || '---',
            memo: pay.PrivateNote || '',
            amount: pay.TotalAmt,
            status: 'Closed',
            statusColor: 'emerald'
        }));

        const bills = (billsData?.QueryResponse?.Bill || [])
            .filter((bill: any) => bill.VendorRef?.value === projectId || bill.CustomerRef?.value === projectId)
            .map((bill: any) => ({
                id: bill.Id,
                date: bill.TxnDate,
                type: 'Bill',
                no: bill.DocNumber || '',
                from: bill.VendorRef?.name || '---',
                memo: bill.PrivateNote || '',
                amount: -bill.TotalAmt,
                status: bill.Balance === 0 ? 'Paid' : 'Open',
                statusColor: bill.Balance === 0 ? 'emerald' : 'amber'
            }));

        // Combine and sort by date descending
        const allTransactions = [...invoices, ...payments, ...bills].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return allTransactions;
    } catch (error) {
        console.error('Error in getProjectTransactions:', error);
        throw error;
    }
}

export async function getProjectProfitability(projectId: string) {
    try {
        console.log(`Fetching Profit & Loss report for project: ${projectId}...`);
        const accessToken = await getAccessToken();
        
        // We'll use a broader date range or let it default to 'This Fiscal Year-to-date'
        const url = `${BASE_URL}/v3/company/${QBO_REALM_ID}/reports/ProfitAndLoss?customer=${projectId}&minorversion=70&summarize_column_by=Total`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) throw new Error(`Report API Error: ${response.status}`);

        const data = await response.json();
        
        let totalIncome = 0;
        let totalCost = 0;
        let netProfit = 0;

        // Recursive function to parse QBO Report Rows
        const parseRows = (rows: any[]) => {
            rows.forEach(row => {
                // Check if this row is a summary row for Income, Expense, or Net Income
                const rowName = row.Summary?.ColData?.[0]?.value || '';
                const rowValue = parseFloat(row.Summary?.ColData?.[1]?.value || '0');

                if (rowName.toLowerCase().includes('total income')) {
                    totalIncome = rowValue;
                } else if (rowName.toLowerCase().includes('total expense') || rowName.toLowerCase().includes('total cost of goods sold')) {
                    totalCost += rowValue;
                } else if (rowName.toLowerCase().includes('net income')) {
                    netProfit = rowValue;
                }

                // Recurse if there are sub-rows
                if (row.Rows?.Row) {
                    parseRows(row.Rows.Row);
                }
            });
        };

        if (data.Rows?.Row) {
            parseRows(data.Rows.Row);
        }

        // Final fallback: if netProfit wasn't found specifically but we have income/cost
        if (netProfit === 0 && totalIncome !== 0) {
            netProfit = totalIncome - totalCost;
        }

        const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

        console.log(`Report Results for ${projectId}: Income=${totalIncome}, Cost=${totalCost}, Profit=${netProfit}`);

        return {
            income: totalIncome,
            cost: totalCost,
            profit: netProfit,
            profitMargin: parseFloat(profitMargin.toFixed(2))
        };
    } catch (error) {
        console.error('Error in getProjectProfitability:', error);
        return { income: 0, cost: 0, profit: 0, profitMargin: 0 };
    }
}
