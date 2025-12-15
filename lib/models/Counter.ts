import mongoose, { Schema, Model } from 'mongoose';

export interface ICounter {
    _id: string;
    seq: number;
    year: number;
}

const CounterSchema: Schema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
    year: { type: Number, default: new Date().getFullYear() }
}, { timestamps: true });

const Counter: Model<ICounter> = mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;
