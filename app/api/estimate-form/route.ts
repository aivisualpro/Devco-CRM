import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Estimate from '@/lib/models/Estimate';
import Client from '@/lib/models/Client';

// Generate a simple token from estimate number (base64 encoded)
function encodeToken(estimateNumber: string): string {
    return Buffer.from(`devco_est_${estimateNumber}_${Date.now()}`).toString('base64url');
}

function decodeToken(token: string): string | null {
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf-8');
        const match = decoded.match(/^devco_est_(.+)_\d+$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// GET: Fetch estimate data for the public form
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const estimateId = searchParams.get('estimateId');
        const token = searchParams.get('token');

        // Generate a share link token for an estimate
        if (estimateId && !token) {
            await connectToDatabase();
            const est = await Estimate.findById(estimateId).lean();
            if (!est) {
                return NextResponse.json({ success: false, error: 'Estimate not found' }, { status: 404 });
            }

            // Generate share token and save it on the estimate
            const shareToken = encodeToken(est.estimate || estimateId);
            
            // Save the token on the estimate for validation later
            await Estimate.findByIdAndUpdate(estimateId, { 
                shareToken,
                shareTokenCreatedAt: new Date()
            });

            return NextResponse.json({ success: true, token: shareToken });
        }

        // Fetch estimate details for public form using token
        if (token) {
            await connectToDatabase();
            
            // Find estimate by share token
            const est = await Estimate.findOne({ shareToken: token }).lean() as any;
            if (!est) {
                return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 });
            }

            // Only allow if status is Won or Completed
            if (!['Won', 'Completed'].includes(est.status || '')) {
                return NextResponse.json({ success: false, error: 'This estimate is no longer accepting submissions' }, { status: 403 });
            }

            // Return only the fields needed for the form (no sensitive data)
            const publicData = {
                _id: est._id,
                estimate: est.estimate,
                projectName: est.projectName || '',
                customerName: est.customerName || '',
                jobAddress: est.jobAddress || '',
                status: est.status,
                // Estimate Detail fields (the form fields)
                accountingContact: est.accountingContact || '',
                accountingEmail: est.accountingEmail || '',
                accountingPhone: est.accountingPhone || '',
                projectId: est.projectId || '',
                poName: est.poName || '',
                PoAddress: est.PoAddress || '',
                PoPhone: est.PoPhone || '',
                ocName: est.ocName || '',
                ocPhone: est.ocPhone || '',
                ocAddress: est.ocAddress || '',
                customerPONo: est.customerPONo || '',
                workRequestNo: est.workRequestNo || '',
                subContractAgreementNo: est.subContractAgreementNo || '',
                customerJobNo: est.customerJobNo || '',
                DIRProjectNo: est.DIRProjectNo || '',
                subCName: est.subCName || '',
                subCAddress: est.subCAddress || '',
                subCPhone: est.subCPhone || '',
                liName: est.liName || '',
                liAddress: est.liAddress || '',
                liPhone: est.liPhone || '',
                scName: est.scName || '',
                scAddress: est.scAddress || '',
                scPhone: est.scPhone || '',
                bondNumber: est.bondNumber || '',
                fbName: est.fbName || '',
                fbAddress: est.fbAddress || '',
                eCPRSystem: est.eCPRSystem || '',
                typeOfServiceRequired: est.typeOfServiceRequired || '',
                wetUtilities: est.wetUtilities || '',
                dryUtilities: est.dryUtilities || '',
                prelimAmount: est.prelimAmount || '',
                projectDescription: est.projectDescription || '',
            };

            return NextResponse.json({ success: true, result: publicData });
        }

        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    } catch (error) {
        console.error('Estimate Form API Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

// POST: Submit form data from customer (updates ALL versions)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, formData } = body;

        if (!token || !formData) {
            return NextResponse.json({ success: false, error: 'Missing token or form data' }, { status: 400 });
        }

        await connectToDatabase();

        // Find estimate by share token
        const est = await Estimate.findOne({ shareToken: token }).lean() as any;
        if (!est) {
            return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 });
        }

        // Only allow if status is Won or Completed
        if (!['Won', 'Completed'].includes(est.status || '')) {
            return NextResponse.json({ success: false, error: 'This estimate is no longer accepting submissions' }, { status: 403 });
        }

        // Whitelist of allowed fields (only the estimate detail fields)
        const ALLOWED_FIELDS = [
            'accountingContact', 'accountingEmail', 'accountingPhone', 'projectId',
            'poName', 'PoAddress', 'PoPhone',
            'ocName', 'ocPhone', 'ocAddress',
            'customerPONo', 'workRequestNo', 'subContractAgreementNo', 'customerJobNo', 'DIRProjectNo',
            'subCName', 'subCAddress', 'subCPhone',
            'liName', 'liAddress', 'liPhone',
            'scName', 'scAddress', 'scPhone', 'bondNumber',
            'fbName', 'fbAddress', 'eCPRSystem',
            'typeOfServiceRequired', 'wetUtilities', 'dryUtilities',
            'prelimAmount', 'projectDescription'
        ];

        // Filter submitted data to only allowed fields
        const sanitizedData: Record<string, any> = {};
        ALLOWED_FIELDS.forEach(field => {
            if (formData[field] !== undefined) {
                sanitizedData[field] = formData[field];
            }
        });

        // Add metadata
        sanitizedData.customerFormSubmittedAt = new Date();
        sanitizedData.updatedAt = new Date();

        // Update ALL versions of this estimate (using the estimate number)
        const estimateNumber = est.estimate;
        if (estimateNumber) {
            await Estimate.updateMany(
                { estimate: estimateNumber },
                { $set: sanitizedData }
            );
        } else {
            // Fallback: update just this document
            await Estimate.findByIdAndUpdate(est._id, { $set: sanitizedData });
        }

        // ── Sync Accounting info to Customer (Client) contacts ──
        const acctName = formData.accountingContact?.trim();
        const acctEmail = formData.accountingEmail?.trim();
        const acctPhone = formData.accountingPhone?.trim();
        const customerId = est.customerId;

        if (customerId && (acctName || acctEmail || acctPhone)) {
            try {
                const client = await Client.findById(customerId);
                if (client) {
                    const contacts = client.contacts || [];

                    // Find existing "Accounting" contact
                    const existingIdx = contacts.findIndex(
                        (c: any) => c.type === 'Accounting'
                    );

                    const accountingContact = {
                        name: acctName || '',
                        email: acctEmail || '',
                        phone: acctPhone || '',
                        type: 'Accounting',
                        active: true,
                        primary: false
                    };

                    if (existingIdx >= 0) {
                        // Update existing Accounting contact
                        contacts[existingIdx] = { ...contacts[existingIdx], ...accountingContact };
                    } else {
                        // Add new Accounting contact
                        contacts.push(accountingContact);
                    }

                    await Client.findByIdAndUpdate(customerId, {
                        $set: { contacts, updatedAt: new Date() }
                    });

                    console.log(`[Estimate Form] Synced accounting contact to Client ${customerId}`);
                }
            } catch (clientErr) {
                // Don't fail the whole request if client sync fails
                console.error('[Estimate Form] Failed to sync accounting to client:', clientErr);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Form submitted successfully. All versions have been updated.' 
        });
    } catch (error) {
        console.error('Estimate Form Submit Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
