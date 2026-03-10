import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPrelimFile {
    url: string;
    r2Key?: string;
    thumbnailUrl?: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    uploadedBy?: string;
    uploadedAt: Date;
}

export interface IPrelimDoc extends Document {
    estimate: string;
    docName: string;                // user-provided file/document name
    createdByName: string;
    createdByEmail: string;
    position: string;
    generatedDate: string;
    generatedFile?: IPrelimFile;    // the PDF generated from Google Doc template
    uploadedFile?: IPrelimFile;     // the manually uploaded file
    createdAt: Date;
    updatedAt: Date;
}

const PrelimFileSchema = new Schema<IPrelimFile>({
    url: { type: String, required: true },
    r2Key: { type: String },
    thumbnailUrl: { type: String },
    fileName: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: Number },
    uploadedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const PrelimDocSchema = new Schema<IPrelimDoc>(
    {
        estimate: { type: String, required: true, index: true },
        docName: { type: String, default: '20 Day Prelim' },
        createdByName: { type: String, default: '' },
        createdByEmail: { type: String, default: '' },
        position: { type: String, default: '' },
        generatedDate: { type: String, default: '' },
        generatedFile: { type: PrelimFileSchema },
        uploadedFile: { type: PrelimFileSchema },
    },
    { timestamps: true, collection: 'prelimDocs' }
);

// Force re-register in dev (hot reload caches old schema with 'type' field)
if (mongoose.models.PrelimDoc) {
    delete mongoose.models.PrelimDoc;
}

const PrelimDoc: Model<IPrelimDoc> = mongoose.model<IPrelimDoc>('PrelimDoc', PrelimDocSchema);

export default PrelimDoc;
