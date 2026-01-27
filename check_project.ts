import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// IMPORTANT: dotenv.config MUST happen BEFORE importing anything that uses process.env at load time
import { connectToDatabase } from './lib/db';
import { DevcoQuickBooks, Schedule } from './lib/models';

async function checkProject(proposalNumber: string) {
    try {
        await connectToDatabase();
        
        console.log(`\n--- Project Info (${proposalNumber}) ---`);
        const project = await DevcoQuickBooks.findOne({ 
            $or: [
                { projectId: proposalNumber },
                { proposalNumber: proposalNumber },
                { project: new RegExp(proposalNumber, 'i') }
            ]
        });

        if (!project) {
            console.log('Project not found');
            return;
        }
        console.log(`ID: ${project.projectId}, Name: ${project.project}, Proposal: ${project.proposalNumber}`);

        const schedules = await Schedule.find({ estimate: project.proposalNumber }).lean();
        console.log(`\nFound ${schedules.length} schedules`);
        
        schedules.forEach(s => {
            const date = s.fromDate ? new Date(s.fromDate).toLocaleDateString() : 'N/A';
            // Try different date formats just in case
            if (date.includes('1/19') || date.includes('01/19')) {
                console.log(`\nMATCHED DATE: ${date}`);
                console.log(`DJT Present: ${!!s.djt}`);
                if (s.djt) {
                    const djt = s.djt as any;
                    console.log(`  djtCost (Total): ${djt.djtCost}`);
                    console.log(`  equipmentUsed: ${JSON.stringify(djt.equipmentUsed, null, 2)}`);
                    const eqCost = (djt.equipmentUsed || []).reduce((sum: number, eq: any) => sum + (eq.cost || 0), 0);
                    console.log(`  Calculated eqCost from items: ${eqCost}`);
                    
                    // Also check for any other cost fields
                    console.log(`  Detailed DJT Keys: ${Object.keys(djt).join(', ')}`);
                }
            }
        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkProject('25-0358');
