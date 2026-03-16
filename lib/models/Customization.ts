import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomization extends Document {
    key: string;            // Unique key like "schedule_sms_notification"
    label: string;          // Display name like "Schedule SMS Notification"
    category: string;       // Group like "sms", "email", etc.
    template: string;       // The template with {{variable}} placeholders
    enabled: boolean;       // Toggle on/off
    variables: string[];    // Available variables for this template, e.g. ["title","fromDate",...]
    createdAt?: Date;
    updatedAt?: Date;
}

const CustomizationSchema = new Schema<ICustomization>({
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    category: { type: String, default: 'sms' },
    template: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    variables: [{ type: String }],
}, { timestamps: true, collection: 'customizations' });

const Customization: Model<ICustomization> =
    mongoose.models.Customization || mongoose.model<ICustomization>('Customization', CustomizationSchema);

export default Customization;
