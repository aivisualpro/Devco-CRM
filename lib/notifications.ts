import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';
import { pushNotification } from '@/lib/pusher';

interface CreateNotificationParams {
    recipientEmails: string[];    // Send to multiple users
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
    createdBy?: string;
}

function isInQuietHours(start: string, end: string): boolean {
    if (!start || !end) return false;
    const now = new Date();
    const currentStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    if (start <= end) {
        return currentStr >= start && currentStr <= end;
    } else {
        // spans midnight
        return currentStr >= start || currentStr <= end;
    }
}

/**
 * Create notifications for multiple recipients in bulk.
 * Uses raw MongoDB connection to avoid any Mongoose model registration issues.
 */
export async function createNotifications(params: CreateNotificationParams): Promise<void> {
    const { recipientEmails, type, title, message, link, metadata = {}, createdBy } = params;

    if (!recipientEmails || recipientEmails.length === 0) return;

    try {
        await connectToDatabase();

        const db = mongoose.connection.db;
        if (!db) {
            console.error('[Notifications] No DB connection available');
            return;
        }

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
            if (process.env.NODE_ENV !== 'production') console.log('[Notifications] No unique recipients after dedup, skipping');
            return;
        }

        // Fetch preferences
        const prefsDocs = await db.collection('constants').find({
            type: 'AppSettings',
            value: { $in: uniqueRecipients.map(e => `notif_prefs_${e}`) }
        }).toArray();
        
        const prefsMap = new Map();
        for (const doc of prefsDocs) {
            const email = doc.value.replace('notif_prefs_', '');
            prefsMap.set(email, doc.data || {});
        }

        const now = new Date();
        const docsToInsert: any[] = [];
        
        for (const email of uniqueRecipients) {
            const prefs = prefsMap.get(email) || {};
            
            // Check type toggle. Default to enabled if not set
            const toggleKey = `type_${type}`;
            if (prefs[toggleKey] === false) {
                continue; // Skip this user
            }
            
            const isSilent = prefs.quietHoursStart && prefs.quietHoursEnd && isInQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd);
            
            docsToInsert.push({
                recipientEmail: email,
                type,
                title,
                message,
                link: link || null,
                read: false,
                metadata: { ...metadata, silent: isSilent || undefined },
                createdBy: createdBy || 'system',
                createdAt: now,
                updatedAt: now,
            });
        }

        if (docsToInsert.length === 0) return;

        const result = await db.collection('notifications').insertMany(docsToInsert);
        
        docsToInsert.forEach((doc, idx) => {
            const notificationId = result.insertedIds[idx].toString();
            pushNotification(doc.recipientEmail, {
                title: doc.title,
                message: doc.message,
                link: doc.link || undefined,
                type: doc.type,
                notificationId,
                metadata: doc.metadata || undefined,
            });
        });

        if (process.env.NODE_ENV !== 'production') console.log(`[Notifications] ✅ Created ${result.insertedCount} notification(s)`);
    } catch (error) {
        console.error('[Notifications] ❌ Failed to create notifications:', error);
    }
}
