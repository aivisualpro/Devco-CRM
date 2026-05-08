import mongoose from 'mongoose';

/**
 * ChartConfig Model
 * 
 * Stores Atlas Charts embed configurations.
 * Each document represents one embedded chart tile in the /reports/charts dashboard.
 */
const ChartConfigSchema = new mongoose.Schema({
    /** Display title shown on the dashboard card */
    title: { type: String, required: true },
    /** Optional subtitle / description */
    description: { type: String, default: '' },
    /** The full iframe src URL from Atlas Charts → Embed Chart → Iframe tab */
    embedUrl: { type: String, required: true },
    /** Layout size: 'small' (1 col), 'medium' (2 cols), 'large' (full width) */
    size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    /** Chart height in pixels */
    height: { type: Number, default: 400 },
    /** Sort order on the dashboard (lower = first) */
    order: { type: Number, default: 0 },
    /** Whether this chart is visible on the dashboard */
    active: { type: Boolean, default: true },
    /** Optional category/group for tab filtering */
    category: { type: String, default: 'General' },
    /** Who created this config */
    createdBy: { type: String, default: '' },
}, { timestamps: true });

export const ChartConfig = mongoose.models.ChartConfig || mongoose.model('ChartConfig', ChartConfigSchema);
