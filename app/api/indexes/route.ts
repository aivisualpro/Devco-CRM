import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db'; // adjust path if needed

export async function GET() {
  try {
    await dbConnect();
    
    // We can also just use mongoose.connection.db
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection failed: db is undefined");
    const collections = ['clients', 'employees', 'estimates', 'tasks'];
    const results: any = {};
    
    for (const collName of collections) {
      try {
        const coll = db.collection(collName);
        const indexes = await coll.indexes();
        results[collName] = indexes;
      } catch (e: any) {
        results[collName] = e.message;
      }
    }
    
    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
