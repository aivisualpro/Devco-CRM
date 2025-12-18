import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChannel extends Document {
    name: string;
    description?: string;
    createdBy: string;
    isPrivate: boolean;
    members: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ChannelSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    createdBy: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    members: { type: [String], default: [] },
}, {
    timestamps: true,
    collection: 'devcoChatChannels'
});

const Channel: Model<IChannel> = mongoose.models.Channel || mongoose.model<IChannel>('Channel', ChannelSchema);
export default Channel;
