import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client, Estimate, Schedule } from '@/lib/models';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: clientId } = payload || {};
                if (!clientId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const client = await Client.findById(clientId);
                if (!client) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: client });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
                    const { id: clientId } = await params;
                    const clientItem = await req.json();
                    if (!clientId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

                    // Handle contact refactoring and migration
                    if (clientItem.accountingContact || clientItem.accountingEmail || clientItem.contactFullName || clientItem.email || clientItem.phone || Array.isArray(clientItem.contacts)) {
                        const contacts = Array.isArray(clientItem.contacts) ? [...clientItem.contacts] : [];

                        // Migrate/Update primary contact info if provided as top-level
                        if (clientItem.contactFullName || clientItem.email || clientItem.phone) {
                            const mainIdx = contacts.findIndex(con => (con.type === 'Main Contact' && con.active) || con.name === clientItem.contactFullName);
                            if (mainIdx > -1) {
                                contacts[mainIdx] = {
                                    ...contacts[mainIdx],
                                    name: clientItem.contactFullName || contacts[mainIdx].name,
                                    email: clientItem.email || contacts[mainIdx].email,
                                    phone: clientItem.phone || contacts[mainIdx].phone
                                };
                            } else {
                                contacts.push({
                                    name: clientItem.contactFullName || 'Main Contact',
                                    email: clientItem.email || '',
                                    phone: clientItem.phone || '',
                                    type: 'Main Contact',
                                    active: contacts.length === 0,
                                    primary: contacts.length === 0
                                });
                            }
                        }

                        // Migrate/Update accounting contact info if provided as top-level
                        if (clientItem.accountingContact || clientItem.accountingEmail) {
                            const accIdx = contacts.findIndex(con => con.type === 'Accounting');
                            if (accIdx > -1) {
                                contacts[accIdx] = {
                                    ...contacts[accIdx],
                                    name: clientItem.accountingContact || contacts[accIdx].name,
                                    email: clientItem.accountingEmail || contacts[accIdx].email
                                };
                            } else {
                                contacts.push({
                                    name: clientItem.accountingContact || 'Accounting',
                                    email: clientItem.accountingEmail || '',
                                    type: 'Accounting',
                                    active: contacts.length === 0,
                                    primary: false
                                });
                            }
                        }

                        // Clean up legacy fields from update object
                        delete (clientItem as any).accountingContact;
                        delete (clientItem as any).accountingEmail;
                        delete (clientItem as any).contactFullName;
                        delete (clientItem as any).email;
                        delete (clientItem as any).phone;

                        // Ensure all contacts have type, active, and primary status
                        const processedContacts = contacts.map((con, idx) => ({
                            ...con,
                            type: con.type || 'Main Contact',
                            active: con.active !== undefined ? con.active : (idx === 0),
                            primary: con.primary !== undefined ? con.primary : (idx === 0)
                        }));

                        // Ensure exactly one is active and exactly one is primary
                        if (processedContacts.length > 0) {
                            if (!processedContacts.some(con => con.active)) processedContacts[0].active = true;
                            if (!processedContacts.some(con => con.primary)) processedContacts[0].primary = true;
                        }

                        clientItem.contacts = processedContacts;
                    }

                    // Handle addresses refactoring and migration
                    if (Array.isArray(clientItem.addresses)) {
                        clientItem.addresses = clientItem.addresses.map((addr: any, idx: number) => {
                            if (typeof addr === 'string') {
                                return { address: addr, primary: idx === 0 };
                            }
                            return addr;
                        });

                        // Ensure exactly one is primary
                        if (clientItem.addresses.length > 0 && !clientItem.addresses.some((a: any) => a.primary)) {
                            clientItem.addresses[0].primary = true;
                        }

                        // Sync businessAddress with primary address
                        const primaryAddr = clientItem.addresses.find((a: any) => a.primary) || clientItem.addresses[0];
                        if (primaryAddr) {
                            clientItem.businessAddress = primaryAddr.address;
                        }
                    }

                    const updated = await Client.findByIdAndUpdate(
                        clientId,
                        { ...clientItem, updatedAt: new Date() },
                        { new: true, strict: false }
                    );

                    // If the client name was updated, sync it to all related estimates and schedules
                    if (clientItem.name && updated) {
                        await Promise.all([
                            Estimate.updateMany(
                                { customerId: clientId },
                                { $set: { customerName: clientItem.name } }
                            ),
                            Schedule.updateMany(
                                { customerId: clientId },
                                { $set: { customerName: clientItem.name } }
                            )
                        ]);
                    }


                    if (updated) {

                    }

                    return NextResponse.json({ success: true, result: updated });
                } catch (err: any) {
                    console.error('[API] updateClient Error:', err);
                    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
                }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: clientDelId } = await params;
                if (!clientDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Client.findByIdAndDelete(clientDelId);



                return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
