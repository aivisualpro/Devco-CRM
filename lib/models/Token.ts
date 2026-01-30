import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IToken extends Document {
    service: string; // e.g., 'quickbooks'
    accessToken: string;
    refreshToken: string;
    realmId?: string;
    expiresAt?: Date;
    refreshTokenExpiresAt?: Date;
    updatedAt: Date;
}

const TokenSchema = new Schema({
    service: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    realmId: { type: String },
    expiresAt: { type: Date },
    refreshTokenExpiresAt: { type: Date }
}, {
    timestamps: true,
    collection: 'tokens'
});

// Prevent model overwrite in development
const Token: Model<IToken> = mongoose.models.Token || mongoose.model<IToken>('Token', TokenSchema);

export default Token;
