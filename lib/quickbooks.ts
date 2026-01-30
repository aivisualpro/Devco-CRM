
export const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID;
export const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
export const QBO_REALM_ID = process.env.QBO_REALM_ID;
// We'll update this in memory, so use let or access process.env directly
let QBO_REFRESH_TOKEN = process.env.QBO_REFRESH_TOKEN;

import fs from 'fs';
import path from 'path';
import { connectToDatabase } from '@/lib/db';
import Token from '@/lib/models/Token';

// Determine if we are in production or development
const IS_PRODUCTION = process.env.QBO_IS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
export const BASE_URL = IS_PRODUCTION
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function getAccessToken() {
    await connectToDatabase();
    
    // 1. Try to get from DB first
    let dbToken = null;
    try {
        dbToken = await Token.findOne({ service: 'quickbooks' });
    } catch (e) {
        console.error('Error fetching token from DB:', e);
    }

    // 2. Fallback to Env variable if DB missing
    let currentRefreshToken = dbToken?.refreshToken || process.env.QBO_REFRESH_TOKEN;

    if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET || !currentRefreshToken) {
        throw new Error('QuickBooks credentials missing (Client ID, Secret, or Refresh Token)');
    }

    // Log which credentials we are using (masking secrets)
    console.log('Refreshing QuickBooks token...');
    console.log(`Using Client ID: ${QBO_CLIENT_ID.substring(0, 5)}...`);
    console.log(`Using Refresh Token Source: ${dbToken ? 'Database' : 'Environment'}`);

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
            refresh_token: currentRefreshToken.trim(),
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
        
        // 1. Persist to MongoDB (Primary Storage)
        try {
            await Token.findOneAndUpdate(
                { service: 'quickbooks' },
                { 
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    realmId: QBO_REALM_ID,
                    expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
                    refreshTokenExpiresAt: new Date(Date.now() + (data.x_refresh_token_expires_in * 1000))
                },
                { upsert: true, new: true }
            );
            console.log('Successfully updated Token in MongoDB.');
        } catch (dbError) {
            console.error('Failed to save token to MongoDB:', dbError);
        }

        // 2. Update in-memory for current process
        process.env.QBO_REFRESH_TOKEN = data.refresh_token; 
        
        // 3. Persist to .env.local for development convenience (optional but helpful)
        if (!IS_PRODUCTION) {
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
            }
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

async function fetchAllOfType(type: string) {
    let all: any[] = [];
    let start = 1;
    const limit = 1000;
    let batchCount = 0;
    let totalFetched = 0;
    while (true) {
        batchCount++;
        const query = `SELECT * FROM ${type} STARTPOSITION ${start} MAXRESULTS ${limit}`;
        console.log(`Fetching ${type} batch ${batchCount}: start=${start}, limit=${limit}`);
        try {
            const data = await qboQuery(query);
            const results = data?.QueryResponse?.[type] || [];
            console.log(`Batch ${batchCount} fetched ${results.length} ${type} records`);
            all.push(...results);
            totalFetched += results.length;
            if (results.length < limit) {
                console.log(`Completed fetching ${type}: total batches=${batchCount}, total records=${totalFetched}`);
                break;
            }
            start += limit;
            // Safety break to prevent infinite loops (max 50,000 items)
            if (start > 50000) {
                console.warn(`Safety break: stopped fetching ${type} after ${totalFetched} records to prevent infinite loop`);
                break;
            }
        } catch (err) {
            console.error(`Error fetching ${type} batch ${batchCount} (start=${start}):`, err);
            // Continue to next batch instead of failing completely
            start += limit;
            if (start > 50000) break;
        }
    }
    return all;
}

export async function getProjects() {
    try {
        console.log('Fetching all customers/projects...');
        const customers = await fetchAllOfType('Customer');
        const projects = customers.filter((c: any) => c.IsProject === true || c.Job === true);

        console.log(`Found ${projects.length} projects. Returning basic project data without transactions.`);

        // Return projects with basic info, transactions will be fetched separately using reports
        const finalizedProjects = projects.map(p => {
            // Robust status mapping
            const jobStatus = (p.JobStatus || '').toLowerCase();
            let status = 'In progress';
            if (!p.Active) {
                status = 'Closed';
            } else if (jobStatus === 'closed' || jobStatus === 'completed') {
                status = 'Completed';
            }

            return {
                ...p,
                status: status,
                income: 0, // Will be calculated from transactions
                cost: 0,
                transactions: [] // Will be populated separately
            };
        });

        console.log(`Successfully fetched ${finalizedProjects.length} projects.`);
        return finalizedProjects;
    } catch (error) {
        console.error('Error in getProjects:', error);
        throw error;
    }
}

export async function getSingleProject(projectId: string) {
    try {
        console.log(`Fetching project details for ID: ${projectId}...`);
        
        // 1. Fetch the Customer/Project details
        const customerData = await qboQuery(`SELECT * FROM Customer WHERE Id = '${projectId}'`);
        const lp = customerData?.QueryResponse?.Customer?.[0];
        
        if (!lp) throw new Error('Project not found in QuickBooks');
        
        console.log(`Syncing project: ${lp.DisplayName} (ID: ${lp.Id}, IsProject: ${lp.IsProject}, Job: ${lp.Job})`);

        // 2. Fetch profitability
        const profitability = await getProjectProfitability(projectId);

        // 3. Fetch transactions using ProfitAndLossDetail report (the proven method!)
        let transactionsData: any[] = [];
        try {
            const accessToken = await getAccessToken();
            const reportUrl = `${BASE_URL}/v3/company/${QBO_REALM_ID}/reports/ProfitAndLossDetail?customer=${projectId}&date_macro=All&minorversion=70`;
            console.log(`Fetching ProfitAndLossDetail report for customer ${projectId}...`);
            
            const reportResponse = await fetch(reportUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });
            
            if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                
                const parseAmount = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
                const transactionsMap = new Map<string, any>();
                
                const traverseRows = (rows: any[]) => {
                    for (const row of rows) {
                        if (row.type === 'Data' && row.ColData) {
                            const getValue = (idx: number) => (row.ColData[idx]?.value) || "";
                            const getId = (idx: number) => (row.ColData[idx]?.id) || null;

                            const date = getValue(0);
                            const type = getValue(1);
                            const txnIdRaw = getId(1);
                            const num = getValue(2);
                            const name = getValue(3);
                            const memo = getValue(4);
                            const split = getValue(5);
                            const amountRaw = getValue(6);
                            const amount = parseAmount(amountRaw);

                            const groupKey = txnIdRaw || `${date}_${type}_${num}_${amount}`;

                            if (!transactionsMap.has(groupKey)) {
                                transactionsMap.set(groupKey, {
                                    id: txnIdRaw || `report-${groupKey}`,
                                    date,
                                    type,
                                    no: num,
                                    from: name,
                                    memo: "",
                                    split: "",
                                    amount: 0,
                                    status: 'Cleared',
                                    statusColor: 'emerald'
                                });
                            }

                            const tx = transactionsMap.get(groupKey);
                            tx.amount += amount;
                            if (memo && memo.length > (tx.memo?.length || 0)) tx.memo = memo;
                            if (split && split.length > (tx.split?.length || 0)) tx.split = split;
                            if (!tx.no && num) tx.no = num;
                            if (!tx.from && name) tx.from = name;
                        } else if (row.Rows?.Row) {
                            traverseRows(row.Rows.Row);
                        }
                    }
                };

                if (reportData.Rows?.Row) {
                    traverseRows(reportData.Rows.Row);
                }
                
                transactionsData = Array.from(transactionsMap.values());
                console.log(`Parsed ${transactionsData.length} transactions from ProfitAndLossDetail report`);
            } else {
                const errorText = await reportResponse.text();
                console.log(`ProfitAndLossDetail report failed: ${reportResponse.status}`, errorText);
            }
        } catch (e) {
            console.log('Error fetching ProfitAndLossDetail report:', e);
        }

        // 4. Robust status mapping
        const jobStatus = (lp.JobStatus || '').toLowerCase();
        let status = 'In progress';
        if (!lp.Active) {
            status = 'Closed';
        } else if (jobStatus === 'closed' || jobStatus === 'completed') {
            status = 'Completed';
        }

        // Return in same format as getProjects items
        return {
            ...lp,
            income: profitability.income,
            cost: profitability.cost,
            profitMargin: profitability.profitMargin,
            status: status,
            transactions: transactionsData.map((t: any) => ({
                id: t.id,
                date: t.date,
                type: t.type,
                no: t.no,
                from: t.from,
                memo: t.memo,
                amount: t.amount,
                status: t.status
            }))
        };
    } catch (error) {
        console.error('Error in getSingleProject:', error);
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
        
        // Fetch relevant transaction types
        // Invoices and Payments can be filtered by CustomerRef directly in the query
        const invoiceQuery = `SELECT * FROM Invoice WHERE CustomerRef = '${projectId}' MAXRESULTS 1000`;
        const paymentQuery = `SELECT * FROM Payment WHERE CustomerRef = '${projectId}' MAXRESULTS 1000`;
        
        // Fetch all potential cost-carrying transaction types
        const [invoicesData, paymentsData, purchasesData, billsData, journalsData, vendorCreditsData, ccCreditsData] = await Promise.all([
            qboQuery(invoiceQuery).catch(() => ({ QueryResponse: {} })),
            qboQuery(paymentQuery).catch(() => ({ QueryResponse: {} })),
            fetchAllOfType('Purchase').catch(() => []), 
            fetchAllOfType('Bill').catch(() => []),
            fetchAllOfType('JournalEntry').catch(() => []),
            fetchAllOfType('VendorCredit').catch(() => []),
            fetchAllOfType('CreditCardCredit').catch(() => [])
        ]);

        // Helper to check if a line is linked to the project
        const isLineLinked = (line: any) => {
            return line.AccountBasedExpenseLineDetail?.CustomerRef?.value === projectId ||
                   line.ItemBasedExpenseLineDetail?.CustomerRef?.value === projectId ||
                   line.DescriptionLineDetail?.CustomerRef?.value === projectId ||
                   line.JournalEntryLineDetail?.Entity?.EntityRef?.value === projectId ||
                   line.CustomerRef?.value === projectId; // Some types have it directly on the line
        };

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

        // Process Purchases (Expenses/Checks)
        const purchases = (purchasesData || [])
            .map(p => {
                // DEBUG: Log if we find the specific transactions from the screenshot
                if (JSON.stringify(p).includes("Jose Hernandez") || JSON.stringify(p).includes("Joseph Dziuk")) {
                    console.log(`DEBUG: Found payroll check for ${JSON.stringify(p).includes("Jose Hernandez") ? "Jose Hernandez" : "Joseph Dziuk"}. Data:`, JSON.stringify(p).substring(0, 500));
                }
                return p;
            })
            .filter((p: any) => p.Line?.some(isLineLinked))
            .flatMap((p: any) => {
                return p.Line.filter(isLineLinked).map((line: any) => ({
                    id: `${p.Id}-${line.Id || Math.random().toString(36).substr(2, 5)}`,
                    date: p.TxnDate,
                    type: (p.PaymentType === 'Check' || p.DocNumber === 'DD') ? 'Payroll Check' : 'Expense',
                    no: p.DocNumber || p.PaymentType || '',
                    from: p.EntityRef?.name || '---',
                    memo: p.PrivateNote || line.Description || '',
                    amount: (line.Amount || 0), 
                    status: 'Cleared',
                    statusColor: 'emerald'
                }));
            });

        // Process CC Credits
        const ccCredits = (ccCreditsData || [])
            .filter((p: any) => p.Line?.some(isLineLinked))
            .flatMap((p: any) => {
                return p.Line.filter(isLineLinked).map((line: any) => ({
                    id: `${p.Id}-${line.Id || Math.random().toString(36).substr(2, 5)}`,
                    date: p.TxnDate,
                    type: 'CC Credit',
                    no: p.DocNumber || '',
                    from: p.EntityRef?.name || '---',
                    memo: p.PrivateNote || line.Description || '',
                    amount: -(line.Amount || 0), // Credit reduces cost, so maybe negative?
                    status: 'Cleared',
                    statusColor: 'emerald'
                }));
            });

        const bills = (billsData || [])
            .filter((bill: any) => bill.Line?.some(isLineLinked))
            .flatMap((bill: any) => {
                return bill.Line.filter(isLineLinked).map((line: any) => ({
                    id: `${bill.Id}-${line.Id || Math.random().toString(36).substr(2, 5)}`,
                    date: bill.TxnDate,
                    type: 'Bill',
                    no: bill.DocNumber || '',
                    from: bill.VendorRef?.name || '---',
                    memo: bill.PrivateNote || line.Description || '',
                    amount: (line.Amount || 0),
                    status: bill.Balance === 0 ? 'Paid' : 'Open',
                    statusColor: bill.Balance === 0 ? 'emerald' : 'amber'
                }));
            });

        const vendorCredits = (vendorCreditsData || [])
            .filter((vc: any) => vc.Line?.some(isLineLinked))
            .flatMap((vc: any) => {
                return vc.Line.filter(isLineLinked).map((line: any) => ({
                    id: `${vc.Id}-${line.Id || Math.random().toString(36).substr(2, 5)}`,
                    date: vc.TxnDate,
                    type: 'Vendor Credit',
                    no: vc.DocNumber || '',
                    from: vc.VendorRef?.name || '---',
                    memo: vc.PrivateNote || line.Description || '',
                    amount: -(line.Amount || 0),
                    status: 'Closed',
                    statusColor: 'emerald'
                }));
            });

        const journals = (journalsData || [])
            .filter((j: any) => j.Line?.some(isLineLinked))
            .flatMap((j: any) => {
                return j.Line.filter(isLineLinked).map((line: any) => {
                    const amount = line.Amount || 0;
                    const isDebit = line.JournalEntryLineDetail?.PostingType === 'Debit';
                    return {
                        id: `${j.Id}-${line.Id || Math.random().toString(36).substr(2, 5)}`,
                        date: j.TxnDate,
                        type: 'Journal Entry',
                        no: j.DocNumber || '',
                        from: line.JournalEntryLineDetail?.Entity?.EntityRef?.name || '---',
                        memo: j.PrivateNote || line.Description || '',
                        amount: amount, // Positive for both debit and credit? UI just shows them.
                        status: 'Cleared',
                        statusColor: 'emerald'
                    };
                });
            });

        // Combine and sort by date descending
        const allTransactions = [...invoices, ...payments, ...purchases, ...ccCredits, ...bills, ...vendorCredits, ...journals].sort((a, b) => 
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
