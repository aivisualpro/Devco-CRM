import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IChat extends Document {
    sender: string; // email
    senderName: string;
    senderImage?: string;
    message: string;
    mentions: string[]; // emails of mentioned users
    references: string[]; // estimate numbers
    createdAt: Date;
    updatedAt: Date;
}

const ChatSchema = new Schema({
    sender: { type: String, required: true },
    senderName: { type: String, required: true },
    senderImage: { type: String },
    message: { type: String, required: true },
    mentions: [{ type: String }],
    references: [{ type: String }],
}, {
    timestamps: true,
    collection: 'devcoChats'
});

// Index for efficient querying by reference or mention
ChatSchema.index({ references: 1 });
ChatSchema.index({ mentions: 1 });
ChatSchema.index({ createdAt: -1 });

// Prevent model overwrite in development
const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
