// Diagnostic script — run via: npx tsx scripts/analyze-employees.ts
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DEVCOAPPSHEET_MONGODB_URI || '';

async function analyze() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    const col = db.collection('devcoEmployees');

    const employees = await col.find({}, {
        projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            profilePicture: 1,
            signature: 1,
            documents: 1,
            drugTestingRecords: 1,
            trainingCertifications: 1,
        }
    }).toArray();

    console.log(`Total employees: ${employees.length}\n`);
    console.log('='.repeat(100));

    let totalBase64ProfilePics = 0;
    let totalBase64Signatures = 0;
    let totalBase64InDocs = 0;
    let totalBase64InDrugs = 0;
    let totalBase64InTraining = 0;

    for (const emp of employees) {
        const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp._id;
        const issues: string[] = [];

        // Check profilePicture
        const pp = emp.profilePicture || '';
        if (pp.startsWith('data:')) {
            const sizeKB = (Buffer.byteLength(pp, 'utf8') / 1024).toFixed(1);
            issues.push(`  ⚠️  profilePicture: BASE64 (${sizeKB} KB)`);
            totalBase64ProfilePics++;
        } else if (pp) {
            issues.push(`  ✅ profilePicture: URL (${pp.substring(0, 80)}...)`);
        }

        // Check signature
        const sig = emp.signature || '';
        if (sig.startsWith('data:')) {
            const sizeKB = (Buffer.byteLength(sig, 'utf8') / 1024).toFixed(1);
            issues.push(`  ⚠️  signature: BASE64 (${sizeKB} KB)`);
            totalBase64Signatures++;
        } else if (sig) {
            issues.push(`  ✅ signature: URL (${sig.substring(0, 80)}...)`);
        }

        // Check documents array
        const docs = emp.documents || [];
        if (docs.length > 0) {
            let base64Count = 0;
            let totalDocSize = 0;
            for (const d of docs) {
                const url = d.fileUrl || '';
                if (url.startsWith('data:')) {
                    base64Count++;
                    totalDocSize += Buffer.byteLength(url, 'utf8');
                    totalBase64InDocs++;
                }
                // Also check if any other fields have base64
                for (const [key, val] of Object.entries(d)) {
                    if (typeof val === 'string' && val.startsWith('data:') && key !== 'fileUrl') {
                        base64Count++;
                        totalDocSize += Buffer.byteLength(val, 'utf8');
                    }
                }
            }
            if (base64Count > 0) {
                issues.push(`  ⚠️  documents[${docs.length}]: ${base64Count} base64 files (${(totalDocSize / 1024).toFixed(1)} KB total)`);
            } else {
                issues.push(`  ✅ documents[${docs.length}]: all URLs`);
            }
        }

        // Check drugTestingRecords
        const drugs = emp.drugTestingRecords || [];
        if (drugs.length > 0) {
            let base64Count = 0;
            let totalDrugSize = 0;
            for (const d of drugs) {
                const url = d.fileUrl || '';
                if (url.startsWith('data:')) {
                    base64Count++;
                    totalDrugSize += Buffer.byteLength(url, 'utf8');
                    totalBase64InDrugs++;
                }
                const files = d.files || [];
                for (const f of files) {
                    if (typeof f === 'string' && f.startsWith('data:')) {
                        base64Count++;
                        totalDrugSize += Buffer.byteLength(f, 'utf8');
                        totalBase64InDrugs++;
                    }
                }
            }
            if (base64Count > 0) {
                issues.push(`  ⚠️  drugTestingRecords[${drugs.length}]: ${base64Count} base64 files (${(totalDrugSize / 1024).toFixed(1)} KB total)`);
            } else {
                issues.push(`  ✅ drugTestingRecords[${drugs.length}]: all URLs`);
            }
        }

        // Check trainingCertifications
        const training = emp.trainingCertifications || [];
        if (training.length > 0) {
            let base64Count = 0;
            let totalTrainSize = 0;
            for (const t of training) {
                const url = t.fileUrl || '';
                if (url.startsWith('data:')) {
                    base64Count++;
                    totalTrainSize += Buffer.byteLength(url, 'utf8');
                    totalBase64InTraining++;
                }
            }
            if (base64Count > 0) {
                issues.push(`  ⚠️  trainingCertifications[${training.length}]: ${base64Count} base64 files (${(totalTrainSize / 1024).toFixed(1)} KB total)`);
            } else {
                issues.push(`  ✅ trainingCertifications[${training.length}]: all URLs`);
            }
        }

        // Calculate raw document size
        const docJson = JSON.stringify(emp);
        const docSizeKB = (Buffer.byteLength(docJson, 'utf8') / 1024).toFixed(1);

        if (issues.length > 0 || parseFloat(docSizeKB) > 5) {
            console.log(`\n👤 ${name} (${emp._id}) — ${docSizeKB} KB`);
            issues.forEach(i => console.log(i));
        }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:');
    console.log(`  Total employees: ${employees.length}`);
    console.log(`  Base64 profilePictures: ${totalBase64ProfilePics}`);
    console.log(`  Base64 signatures: ${totalBase64Signatures}`);
    console.log(`  Base64 files in documents[]: ${totalBase64InDocs}`);
    console.log(`  Base64 files in drugTestingRecords[]: ${totalBase64InDrugs}`);
    console.log(`  Base64 files in trainingCertifications[]: ${totalBase64InTraining}`);
    console.log(`  TOTAL base64 blobs: ${totalBase64ProfilePics + totalBase64Signatures + totalBase64InDocs + totalBase64InDrugs + totalBase64InTraining}`);

    // Top 10 largest documents
    const sized = employees.map(e => ({
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        id: e._id,
        sizeKB: parseFloat((Buffer.byteLength(JSON.stringify(e), 'utf8') / 1024).toFixed(1)),
        docs: (e.documents || []).length,
        drugs: (e.drugTestingRecords || []).length,
        training: (e.trainingCertifications || []).length,
    })).sort((a, b) => b.sizeKB - a.sizeKB);

    console.log('\n📦 TOP 10 LARGEST EMPLOYEE DOCUMENTS:');
    console.log('-'.repeat(90));
    console.log(`${'Name'.padEnd(25)} ${'Size'.padStart(10)} ${'Docs'.padStart(6)} ${'Drugs'.padStart(6)} ${'Training'.padStart(10)} ID`);
    console.log('-'.repeat(90));
    for (const e of sized.slice(0, 10)) {
        console.log(`${e.name.padEnd(25)} ${(e.sizeKB + ' KB').padStart(10)} ${String(e.docs).padStart(6)} ${String(e.drugs).padStart(6)} ${String(e.training).padStart(10)} ${e.id}`);
    }

    await mongoose.disconnect();
}

analyze().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
