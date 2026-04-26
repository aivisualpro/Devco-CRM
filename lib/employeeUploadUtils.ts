import { uploadToR2 } from '@/lib/s3';
import cloudinary from '@/lib/cloudinary';

export async function uploadImage(imageString: string, publicId: string): Promise<string | null> {
    if (!imageString || !imageString.startsWith('data:image')) return imageString;

    try {
        const safeId = publicId.replace(/[^a-zA-Z0-9]/g, '_');
        const uploadResult = await cloudinary.uploader.upload(imageString, {
            public_id: `employees/${safeId}`,
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" }
            ]
        });
        return uploadResult.secure_url;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        return null;
    }
}

export async function uploadDocFileToR2(base64: string, key: string): Promise<string | null> {
    if (!base64 || !base64.startsWith('data:')) return base64; 
    try {
        const contentTypeMatch = base64.match(/^data:([^;]+);base64,/);
        const contentType = contentTypeMatch?.[1] || 'application/octet-stream';
        
        let ext = '';
        if (contentType.includes('pdf')) ext = '.pdf';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('png')) ext = '.png';
        else if (contentType.includes('gif')) ext = '.gif';
        else if (contentType.includes('msword') || contentType.includes('wordprocessingml')) ext = '.docx';

        const url = await uploadToR2(base64, `employee-docs/${key}${ext}`, contentType);
        return url;
    } catch (error) {
        console.error('R2 Doc Upload Error:', error);
        return null;
    }
}

export async function processEmployeeSubDocFiles(item: any, empId: string): Promise<any> {
    const safeId = empId.replace(/[^a-zA-Z0-9]/g, '_');

    // Process documents[]
    if (Array.isArray(item.documents)) {
        for (let i = 0; i < item.documents.length; i++) {
            const doc = item.documents[i];
            if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
                const url = await uploadDocFileToR2(doc.fileUrl, `${safeId}_doc_${i}_${Date.now()}`);
                if (url) item.documents[i].fileUrl = url;
            }
            if (Array.isArray(doc.files)) {
                for (let j = 0; j < doc.files.length; j++) {
                    if (typeof doc.files[j] === 'string' && doc.files[j].startsWith('data:')) {
                        const url = await uploadDocFileToR2(doc.files[j], `${safeId}_doc_${i}_f${j}_${Date.now()}`);
                        if (url) item.documents[i].files[j] = url;
                    }
                }
            }
        }
    }

    // Process drugTestingRecords[]
    if (Array.isArray(item.drugTestingRecords)) {
        for (let i = 0; i < item.drugTestingRecords.length; i++) {
            const rec = item.drugTestingRecords[i];
            if (rec.fileUrl && rec.fileUrl.startsWith('data:')) {
                const url = await uploadDocFileToR2(rec.fileUrl, `${safeId}_drug_${i}_${Date.now()}`);
                if (url) item.drugTestingRecords[i].fileUrl = url;
            }
            if (Array.isArray(rec.files)) {
                for (let j = 0; j < rec.files.length; j++) {
                    if (typeof rec.files[j] === 'string' && rec.files[j].startsWith('data:')) {
                        const url = await uploadDocFileToR2(rec.files[j], `${safeId}_drug_${i}_f${j}_${Date.now()}`);
                        if (url) item.drugTestingRecords[i].files[j] = url;
                    }
                }
            }
        }
    }

    // Process trainingCertifications[]
    if (Array.isArray(item.trainingCertifications)) {
        for (let i = 0; i < item.trainingCertifications.length; i++) {
            const cert = item.trainingCertifications[i];
            if (cert.fileUrl && cert.fileUrl.startsWith('data:')) {
                const url = await uploadDocFileToR2(cert.fileUrl, `${safeId}_cert_${i}_${Date.now()}`);
                if (url) item.trainingCertifications[i].fileUrl = url;
            }
        }
    }
    return item;
}
