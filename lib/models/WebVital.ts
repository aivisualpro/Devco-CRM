import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IWebVital extends Document {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  navigationType: string;
  route: string;
  createdAt: Date;
}

const WebVitalSchema = new Schema<IWebVital>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    value: { type: Number, required: true },
    rating: { type: String, required: true },
    delta: { type: Number, required: true },
    navigationType: { type: String, required: false },
    route: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export const WebVital: Model<IWebVital> =
  mongoose.models.WebVital || mongoose.model<IWebVital>('WebVital', WebVitalSchema);
