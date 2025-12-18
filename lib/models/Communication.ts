import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
    senderId: string;
    text: string;
    type: 'proposal' | 'channel' | 'direct';
    targetId: string; // can be proposalNo, channelId, or employee email
    attachments: {
        url: string;
        filename: string;
        fileType: string;
    }[];
    mentions: string[];
    estimateRef?: string;
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema({
    senderId: { type: String, required: true },
    text: { type: String },
    type: { type: String, enum: ['proposal', 'channel', 'direct'], required: true },
    targetId: { type: String, required: true },
    attachments: [{
        url: { type: String },
        filename: { type: String },
        fileType: { type: String }
    }],
    mentions: { type: [String], default: [] },
    estimateRef: { type: String },
}, {
    timestamps: true,
    collection: 'DevcoCommunicationDb' // As requested by the user
});

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
export default Message;
