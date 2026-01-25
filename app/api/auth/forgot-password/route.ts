import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/lib/models';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
    try {
        console.log('[Forgot Password] Request received');
        const body = await request.json();
        const { email } = body;

        if (!email) {
            console.log('[Forgot Password] Email missing in request');
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            );
        }

        console.log(`[Forgot Password] Connecting to DB...`);
        await connectToDatabase();
        console.log(`[Forgot Password] DB Connected`);

        // Find employee by email (case-insensitive)
        const searchEmail = email.trim().toLowerCase();
        const employee = await Employee.findOne({ 
            $or: [
                { email: { $regex: new RegExp(`^${searchEmail}$`, 'i') } },
                { _id: searchEmail }
            ]
        });

        if (!employee) {
            console.log(`[Forgot Password] User not found: ${searchEmail}`);
            return NextResponse.json(
                { success: false, error: 'User with this email not found' },
                { status: 404 }
            );
        }

        console.log(`[Forgot Password] User found: ${employee.firstName} ${employee.lastName}`);

        if (!employee.password) {
             console.log(`[Forgot Password] No password found for user`);
             return NextResponse.json(
                { success: false, error: 'No password found for this account. Please contact administrator.' },
                { status: 400 }
            );
        }

        // Send Email via Resend
        console.log(`[Forgot Password] Sending email to ${employee.email}...`);
        
        const { data, error } = await resend.emails.send({
            from: 'DEVCO ERP Solutions <onboarding@resend.dev>',
            to: employee.email,
            subject: 'Password Recovery - DEVCO ERP SOLUTIONS',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                                    <!-- Header with Gradient -->
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0ea5e9 100%); padding: 40px 40px 50px 40px; text-align: center;">
                                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px;">DEVCO ERP</h1>
                                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Cloud Solutions</p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 0 40px;">
                                            <!-- Icon Circle -->
                                            <div style="margin-top: -30px; text-align: center;">
                                                <div style="display: inline-block; width: 60px; height: 60px; background-color: #ffffff; border-radius: 50%; box-shadow: 0 4px 14px rgba(0,0,0,0.1); line-height: 60px; font-size: 28px;">
                                                    🔐
                                                </div>
                                            </div>
                                            
                                            <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; text-align: center; margin: 24px 0 8px 0;">Password Recovery</h2>
                                            <p style="color: #64748b; font-size: 15px; text-align: center; margin: 0 0 32px 0;">We received a request to retrieve your account password</p>
                                            
                                            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Hello <strong>${employee.firstName}</strong>,</p>
                                            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">You requested your password for the DEVCO ERP system. Here are your login credentials:</p>
                                            
                                            <!-- Password Box -->
                                            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                                                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your Password</p>
                                                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e40af; letter-spacing: 2px; font-family: 'Courier New', monospace;">${employee.password}</p>
                                            </div>
                                            
                                            <!-- Security Notice -->
                                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px; margin: 24px 0;">
                                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                                                    <strong>🔒 Security Tip:</strong> For your protection, we recommend changing your password after logging in.
                                                </p>
                                            </div>
                                            
                                            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 24px 0;">If you didn't request this email, you can safely ignore it. Your password will remain unchanged.</p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding: 32px 40px; border-top: 1px solid #e2e8f0; margin-top: 24px;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="text-align: center;">
                                                        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Need help? Contact our support team</p>
                                                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} DEVCO ERP Solutions. All rights reserved.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Bottom Text -->
                                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 24px 0 0 0;">
                                    This is an automated message from DEVCO ERP Solutions.<br>
                                    Please do not reply directly to this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('[Forgot Password] Resend error:', error);
            return NextResponse.json(
                { success: false, error: error.message || 'Failed to send email' },
                { status: 500 }
            );
        }

        console.log(`[Forgot Password] Email sent successfully, id: ${data?.id}`);

        return NextResponse.json({
            success: true,
            message: 'Password has been sent to your email'
        });

    } catch (error: any) {
        console.error('[Forgot Password] ERROR:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'An error occurred. Please try again later.' },
            { status: 500 }
        );
    }
}
