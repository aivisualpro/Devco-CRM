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
    if (cached.conn) {
        return cached.conn;
    }


    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            // Connection Pool Settings (critical for serverless)
            maxPoolSize: 10, // Maximum connections in the pool
            minPoolSize: 2,  // Minimum connections to maintain
            // Timeout Settings (prevent hanging connections)
            serverSelectionTimeoutMS: 5000, // 5 seconds to select a server
            socketTimeoutMS: 45000,         // 45 seconds socket timeout
            // Performance Settings
            family: 4, // Use IPv4, skip IPv6 DNS lookup for faster connection
        };

        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            console.log('✅ MongoDB Connected Successfully');
            return mongoose;
        }).catch((error) => {
            console.error('❌ MongoDB Connection Error:', error);
            cached.promise = null; // Reset on error
            throw error;
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


