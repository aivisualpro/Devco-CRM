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
    // Return existing connection if it's ready
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        // Balanced settings for Vercel serverless - not too aggressive
        const opts = {
            bufferCommands: false,
            maxPoolSize: 10,
            // Use reasonable timeouts (default 30s is too long, 5s is too short)
            serverSelectionTimeoutMS: 15000,  // 15s - enough for cold starts
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
        };

        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default connectToDatabase;

