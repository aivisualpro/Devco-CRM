import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mongoose from 'mongoose';

const standardProposalContent = `
<div class="font-sans text-gray-800 p-8 max-w-[800px] mx-auto bg-white">
    <!-- Header -->
    <div class="flex justify-between items-start mb-12 border-b-2 border-blue-600 pb-6">
        <div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">PROPOSAL</h1>
            <p class="text-gray-600">#{{proposalNo}}</p>
        </div>
        <div class="text-right">
            <h2 class="text-xl font-bold text-blue-600">DevCo Development</h2>
            <p>123 Construction Way</p>
            <p>Date: {{formatDate date}}</p>
        </div>
    </div>

    <!-- Recipient -->
    <div class="mb-12 bg-gray-50 p-6 rounded-lg">
        <h3 class="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Prepared For</h3>
        <p class="text-xl font-semibold">{{customerName}}</p>
        <p>{{job.address}}</p>
    </div>

    <!-- Scope of Work (Grouped) -->
    <div class="mb-12">
        <h3 class="text-xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">Scope of Work</h3>
        
        {{#each (groupBy lineItems.labor "classification")}}
            <div class="mb-6 break-inside-avoid">
                <h4 class="font-bold text-blue-700 text-lg mb-3 uppercase tracking-wide">{{key}}</h4>
                <ul class="list-none space-y-3 pl-0">
                {{#each this}}
                    <li class="pl-4 border-l-4 border-gray-200 py-1">
                        <span class="font-semibold text-gray-900">{{subClassification}}</span>: 
                        Devco will provide labor/equipment to {{description}} 
                        <span class="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-sm font-medium ml-2">{{quantity}} {{uom}}</span>
                    </li>
                {{/each}}
                </ul>
            </div>
        {{/each}}
    </div>

    <!-- Exclusions -->
    <div class="mb-12">
        <h3 class="text-sm font-bold text-red-600 uppercase tracking-wide mb-3">Exclusions</h3>
        <ul class="grid grid-cols-2 gap-2 text-sm text-gray-500 list-disc list-inside">
            <li>Permits and fees</li>
            <li>Traffic Control</li>
            <li>Engineering</li>
            <li>Staking/Surveying</li>
            <li>Utility Fees</li>
            <li>Handling of hazardous materials</li>
        </ul>
    </div>

    <!-- Pricing -->
    <div class="bg-gray-900 text-white p-8 rounded-xl mb-12 flex justify-between items-center shadow-lg print:bg-gray-200 print:text-black">
        <div>
            <p class="text-gray-400 print:text-gray-600 text-sm uppercase tracking-wider">Total Project Cost</p>
            <p class="text-xs text-gray-500 print:text-gray-500 mt-1">Includes all labor, materials, and overhead</p>
        </div>
        <div class="text-4xl font-bold font-mono">
            {{formatCurrency aggregations.grandTotal}}
        </div>
    </div>

    <!-- Signatures -->
    <div class="grid grid-cols-2 gap-12 pt-12 border-t border-gray-200 break-inside-avoid">
        <div>
            <p class="mb-8 font-bold">Acceptance of Proposal</p>
            <div class="border-b border-gray-400 h-8"></div>
            <p class="mt-2 text-sm text-gray-500">Signature</p>
        </div>
        <div>
            <p class="mb-8 font-bold">Date</p>
            <div class="border-b border-gray-400 h-8"></div>
            <p class="mt-2 text-sm text-gray-500">Date</p>
        </div>
    </div>
</div>
`;

const simpleQuoteContent = `
<div class="font-mono text-sm max-w-[600px] mx-auto p-4 border border-gray-300">
    <div class="text-center mb-6">
        <h1 class="text-2xl font-bold">SIMPLE QUOTE</h1>
        <p>{{proposalNo}} | {{formatDate date}}</p>
    </div>

    <div class="mb-6">
        <strong>Customer:</strong> {{customerName}}<br/>
        <strong>Project:</strong> {{projectTitle}}
    </div>

    <table class="w-full mb-6">
        <thead>
            <tr class="border-b border-black">
                <th class="text-left py-2">Item</th>
                <th class="text-right py-2">Qty</th>
                <th class="text-right py-2">Total</th>
            </tr>
        </thead>
        <tbody>
            {{#each lineItems.labor}}
            <tr>
                <td class="py-1">{{classification}} - {{subClassification}}</td>
                <td class="text-right">{{quantity}}</td>
                <td class="text-right">{{formatCurrency total}}</td>
            </tr>
            {{/each}}
             {{#each lineItems.material}}
            <tr>
                <td class="py-1">{{item}}</td>
                <td class="text-right">{{quantity}}</td>
                <td class="text-right">{{formatCurrency total}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    <div class="text-right text-xl font-bold border-t border-black pt-4">
        TOTAL: {{formatCurrency aggregations.grandTotal}}
    </div>
    
    <div class="mt-8 text-center text-xs text-gray-500">
        Valid for 30 days.
    </div>
</div>
`;

const seedTemplates = async () => {
    try {
        const { connectToDatabase } = await import('../lib/db');
        const { default: Template } = await import('../lib/models/Template');

        await connectToDatabase();
        console.log('Connected to DB');

        const templates = [
            {
                title: 'Standard Proposal',
                subTitle: 'Professional',
                subTitleDescription: 'Grouped scope of work with exclusions',
                content: standardProposalContent,
                version: 1,
                isCurrent: true,
                included: 'Included',
                status: 'Active'
            },
            {
                title: 'Simple Quote',
                subTitle: 'Basic',
                subTitleDescription: 'Simple itemized list',
                content: simpleQuoteContent,
                version: 1,
                isCurrent: true,
                included: 'Included',
                status: 'Active'
            }
        ];

        for (const tmpl of templates) {
            // Check if exists
            const exists = await Template.findOne({ title: tmpl.title });
            if (!exists) {
                await Template.create(tmpl);
                console.log(`Created template: ${tmpl.title}`);
            } else {
                console.log(`Template already exists: ${tmpl.title}`);
                // Optional: Update content if you want to force refresh
                exists.content = tmpl.content;
                await exists.save();
                console.log(`Updated content for: ${tmpl.title}`);
            }
        }

        console.log('Done');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedTemplates();
