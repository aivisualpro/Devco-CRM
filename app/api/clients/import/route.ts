import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Client } from '@/lib/models';

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { clients: importClientsArray } = body || {};
                if (!Array.isArray(importClientsArray)) return NextResponse.json({ success: false, error: 'Invalid clients array' }, { status: 400 });

                const operations = importClientsArray.map((client: any) => {
                    const contacts: any[] = [];
                    if (Array.isArray(client.contacts)) {
                        client.contacts.forEach((con: any, idx: number) => {
                            contacts.push({
                                ...con,
                                type: con.type || 'Main Contact',
                                active: con.active !== undefined ? con.active : (idx === 0)
                            });
                        });
                    }

                    // Map legacy main contact info to contacts array
                    if (client.contactFullName || client.email || client.phone) {
                        const exists = contacts.some(con => con.name === client.contactFullName);
                        if (!exists) {
                            contacts.push({
                                name: client.contactFullName || 'Primary Contact',
                                email: client.email || '',
                                phone: client.phone || '',
                                extension: client.extension || client.Extension || client.Ext || '',
                                type: 'Main Contact',
                                active: contacts.length === 0
                            });
                        }
                    }

                    // Map legacy accounting info
                    if (client.accountingContact || client.accountingEmail) {
                        const exists = contacts.some(con => con.name === client.accountingContact && con.type === 'Accounting');
                        if (!exists) {
                            contacts.push({
                                name: client.accountingContact || 'Accounting Contact',
                                email: client.accountingEmail || '',
                                type: 'Accounting',
                                active: contacts.length === 0
                            });
                        }
                    }

                    // Final check: ensure at least one active
                    if (contacts.length > 0 && !contacts.some(con => con.active)) {
                        contacts[0].active = true;
                    }

                    const updateData: any = {
                        ...client,
                        _id: client.recordId || client._id,
                        contacts,
                        updatedAt: new Date()
                    };
                    delete updateData.accountingContact;
                    delete updateData.accountingEmail;
                    delete updateData.contactFullName;
                    delete updateData.email;
                    delete updateData.phone;
                    delete updateData.extension;

                    // Map legacy single address to addresses array if not already present
                    if (client.businessAddress && (!client.addresses || client.addresses.length === 0)) {
                        updateData.addresses = [{ address: client.businessAddress, primary: true }];
                    } else if (Array.isArray(client.addresses)) {
                        updateData.addresses = client.addresses.map((addr: any, idx: number) => {
                            if (typeof addr === 'string') {
                                return { address: addr, primary: idx === 0 };
                            }
                            return addr;
                        });
                    }

                    // Final check for addresses primary
                    if (Array.isArray(updateData.addresses) && updateData.addresses.length > 0) {
                        if (!updateData.addresses.some((a: any) => a.primary)) {
                            updateData.addresses[0].primary = true;
                        }
                        // Sync businessAddress
                        const primaryAddr = updateData.addresses.find((a: any) => a.primary);
                        if (primaryAddr) updateData.businessAddress = primaryAddr.address;
                    }

                    return {
                        updateOne: {
                            filter: { _id: client.recordId || client._id },
                            update: {
                                $set: updateData,
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                const result = await Client.bulkWrite(operations);
                return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
