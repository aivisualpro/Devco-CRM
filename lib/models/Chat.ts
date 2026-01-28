import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IChat extends Document {
    sender: string; // email
    message: string;
    estimate?: string; // estimate number reference
    assignee?: string; // assigned user email
    createdAt: Date;
    updatedAt: Date;
}

const ChatSchema = new Schema({
    sender: { type: String, required: true },
    message: { type: String, required: true },
    estimate: { type: String },
    assignee: { type: String },
}, {
    timestamps: true,
    collection: 'devcoChats'
});

// Index for efficient querying
ChatSchema.index({ estimate: 1 });
ChatSchema.index({ assignee: 1 });
ChatSchema.index({ createdAt: -1 });

// Prevent model overwrite in development
const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
