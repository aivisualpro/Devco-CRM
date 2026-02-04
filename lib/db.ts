import mongoose from 'mongoose';

const MONGODB_URI = process.env.NODE_ENV === 'development'
    ? (process.env.DEVCOAPPSHEET_MONGODB_URI || process.env.MONGODB_URI)
    : (process.env.MONGODB_URI || process.env.DEVCOAPPSHEET_MONGODB_URI);

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI or DEVCOAPPSHEET_MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
    global.mongoose = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
    // Return existing connection immediately if available
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        // Optimized settings for Vercel serverless environment
        const opts = {
            bufferCommands: false,
            // Connection pool settings optimized for serverless
            maxPoolSize: 10,           // Max connections in the pool
            minPoolSize: 1,            // Keep at least 1 connection ready
            // Faster timeouts for serverless cold starts
            serverSelectionTimeoutMS: 5000,  // 5s instead of 30s default
            socketTimeoutMS: 45000,          // 45s for long operations
            connectTimeoutMS: 10000,         // 10s to establish connection
            // Keep connections alive
            heartbeatFrequencyMS: 10000,
            // Retry settings
            retryWrites: true,
            retryReads: true,
        };

        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            console.log('[DB] MongoDB connected successfully');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('[DB] MongoDB connection error:', e);
        throw e;
    }

    return cached.conn;
}

export default connectToDatabase;
