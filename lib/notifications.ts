import { connectToDatabase } from '@/lib/db';
import Notification from '@/lib/models/Notification';

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
 * This is fire-and-forget — errors are logged but don't throw.
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
                if (!email) return false;
                const normalized = email.toLowerCase().trim();
                if (seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });

        if (uniqueRecipients.length === 0) return;

        const docs = uniqueRecipients.map(email => ({
            recipientEmail: email.toLowerCase().trim(),
            type,
            title,
            message,
            link,
            read: false,
            metadata: metadata || {},
            createdBy: createdBy || 'system',
        }));

        await Notification.insertMany(docs);
        console.log(`[Notifications] Created ${docs.length} notification(s) for type: ${type}`);
    } catch (error) {
        console.error('[Notifications] Failed to create notifications:', error);
    }
}
