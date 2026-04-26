import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({ date: Date });
const TestModel = mongoose.models.Test || mongoose.model('Test', testSchema);

const doc = new TestModel({ date: "2026-04-25T17:00" });
console.log(doc.date.toISOString());
