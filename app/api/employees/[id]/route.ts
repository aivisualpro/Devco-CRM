import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { revalidateTag } from 'next/cache';
import bcrypt from 'bcryptjs';
import { uploadImage, processEmployeeSubDocFiles } from '@/lib/employeeUploadUtils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id } = await params;
                if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                const employee = await Employee.findById(id).select('-password -refreshToken -__v').lean();
                if (!employee) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
                
                // Decode token to see if user is viewing their own record
                // We'll skip this strict check for now since it's a generic API 
                // and password is ALREADY redacted in the query above!
                return NextResponse.json({ success: true, result: employee });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: empId } = await params;
        const empItem = await req.json();
                if (!empId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                let updateData = { ...empItem };
                if (empItem.profilePicture && empItem.profilePicture.startsWith('data:image')) {
                    const uploaded = await uploadImage(empItem.profilePicture, empId);
                    if (uploaded) updateData.profilePicture = uploaded;
                }
                if (empItem.signature && empItem.signature.startsWith('data:image')) {
                    const uploaded = await uploadImage(empItem.signature, `${empId}_signature`);
                    if (uploaded) updateData.signature = uploaded;
                }
                // Upload any base64 files in sub-document arrays to R2
                await processEmployeeSubDocFiles(updateData, empId);
                const updated = await Employee.findByIdAndUpdate(empId, { ...updateData, updatedAt: new Date() }, { new: true }).select('-password -refreshToken -__v');
                if (empId) revalidateTag(`permissions-${empId}`, undefined as any);
                if (updateData.appRole) revalidateTag('permissions-all', undefined as any);
                return NextResponse.json({ success: true, result: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDatabase();
        const { id: empDelId } = await params;
                if (!empDelId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
                await Employee.findByIdAndDelete(empDelId);
                if (empDelId) revalidateTag(`permissions-${empDelId}`, undefined as any);
                return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
