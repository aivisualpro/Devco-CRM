import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

interface CreateNotificationParams {
    recipientEmails: string[];    // Send to multiple users
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
    createdBy?: string;
}

/**
 * Create notifications for multiple recipients in bulk.
 * Uses raw MongoDB connection to avoid any Mongoose model registration issues.
 */
export async function createNotifications(params: CreateNotificationParams): Promise<void> {
    const { recipientEmails, type, title, message, link, metadata, createdBy } = params;

    if (!recipientEmails || recipientEmails.length === 0) return;

    try {
        await connectToDatabase();

        // De-duplicate recipients (case-insensitive)
        const seen = new Set<string>();
        const uniqueRecipients = recipientEmails
            .filter(email => {
                if (!email || typeof email !== 'string') return false;
                const normalized = email.toLowerCase().trim();
                if (seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });

        if (uniqueRecipients.length === 0) {
            console.log('[Notifications] No unique recipients after dedup, skipping');
            return;
        }

        const now = new Date();
        const docs = uniqueRecipients.map(email => ({
            recipientEmail: email.toLowerCase().trim(),
            type,
            title,
            message,
            link: link || null,
            read: false,
            metadata: metadata || {},
            createdBy: createdBy || 'system',
            createdAt: now,
            updatedAt: now,
        }));

        // Use raw MongoDB collection — bypasses any Mongoose model issues
        const db = mongoose.connection.db;
        if (!db) {
            console.error('[Notifications] No DB connection available');
            return;
        }

        const result = await db.collection('notifications').insertMany(docs);
        console.log(`[Notifications] ✅ Created ${result.insertedCount} notification(s) for: ${uniqueRecipients.join(', ')}`);
    } catch (error) {
        console.error('[Notifications] ❌ Failed to create notifications:', error);
    }
}
