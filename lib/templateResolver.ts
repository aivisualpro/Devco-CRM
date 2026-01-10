import Handlebars from 'handlebars';
import _ from 'lodash';
import { IEstimate } from './models/Estimate';

// Register Helpers
Handlebars.registerHelper('formatCurrency', (value) => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
});

Handlebars.registerHelper('formatDate', (value, format) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    // Basic format support (can extend if needed, or use date-fns)
    // For now, default to standard US format
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
});

Handlebars.registerHelper('groupBy', (list, property) => {
    if (!Array.isArray(list)) return {};
    return _.groupBy(list, property);
});

Handlebars.registerHelper('eq', (a, b) => {
    return a === b;
});

// Helper to flatten/prepare context
const prepareContext = (estimate: IEstimate) => {
    // Ensure all arrays exist
    const e = estimate as any;
    const lineItems = {
        labor: e.labor || [],
        equipment: e.equipment || [],
        material: e.material || [],
        tools: e.tools || [],
        overhead: e.overhead || [],
        subcontractor: e.subcontractor || [],
        disposal: e.disposal || [],
        miscellaneous: e.miscellaneous || []
    };

    // Helper to format as $X,XXX.XX
    const formatMoney = (val: any) => {
        const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
    };

    // Calculate generic aggregations if needed (though usually passed in estimate)
    // We can add specific aggregations here that might be useful for templates
    const aggregations = {
        laborTotal: formatMoney(_.sumBy(lineItems.labor, (i: any) => i.total || 0)),
        equipmentTotal: formatMoney(_.sumBy(lineItems.equipment, (i: any) => i.total || 0)),
        materialTotal: formatMoney(_.sumBy(lineItems.material, (i: any) => i.total || 0)),
        toolsTotal: formatMoney(_.sumBy(lineItems.tools, (i: any) => i.total || 0)),
        overheadTotal: formatMoney(_.sumBy(lineItems.overhead, (i: any) => i.total || 0)),
        subcontractorTotal: formatMoney(_.sumBy(lineItems.subcontractor, (i: any) => i.total || 0)),
        disposalTotal: formatMoney(_.sumBy(lineItems.disposal, (i: any) => i.total || 0)),
        miscellaneousTotal: formatMoney(_.sumBy(lineItems.miscellaneous, (i: any) => i.total || 0)),
        subTotal: formatMoney(e.subTotal || 0),
        grandTotal: formatMoney(e.grandTotal || 0)
    };

    return {
        ...e, // Spread raw estimate properties (customerName, etc.)
        lineItems, // Explicitly grouped line items
        aggregations,
        // Mappings for template variables
        proposalNo: `${e.estimate || 'DRAFT'}-V${e.versionNumber || 1}`,
        fullProposalId: `${e.estimate || 'DRAFT'}-V${e.versionNumber || 1}`,
        jobAddress: e.jobAddress || '',
        customerName: e.customerName || e.customer || 'Valued Customer',
        clientName: e.customerName || e.customer || 'Valued Customer',
        projectName: e.projectName || e.projectTitle || '',
        projectTitle: e.projectTitle || e.projectName || '',
        contactName: e.contactName || '',
        contactPerson: e.contactName || '',
        contactPhone: e.contactPhone || '',
        contactEmail: e.contactEmail || '',
        today: new Date(),
    };
};

// List of custom variable names that should NOT be processed by Handlebars
const CUSTOM_VAR_NAMES = [
    'customText', 'customCurrency', 'customNumber',
    'lineItemLabor', 'lineItemEquipment', 'lineItemMaterial', 'lineItemTool',
    'lineItemOverhead', 'lineItemSubcontractor', 'lineItemDisposal', 'lineItemMiscellaneous'
];

// Escape custom variables before Handlebars processing
const escapeCustomVars = (content: string): string => {
    let escaped = content;
    CUSTOM_VAR_NAMES.forEach(name => {
        // Replace {{varName}} with a placeholder that Handlebars won't touch
        const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
        escaped = escaped.replace(regex, `__CUSTOM_VAR_${name}__`);
    });
    return escaped;
};

// Restore custom variables after Handlebars processing
const restoreCustomVars = (content: string): string => {
    let restored = content;
    CUSTOM_VAR_NAMES.forEach(name => {
        const regex = new RegExp(`__CUSTOM_VAR_${name}__`, 'g');
        restored = restored.replace(regex, `{{${name}}}`);
    });
    return restored;
};

export const resolveString = (content: string, context: any) => {
    if (!content) return '';
    try {
        // Escape custom vars before Handlebars
        const escaped = escapeCustomVars(content);
        const template = Handlebars.compile(escaped);
        let result = template(context);
        // Restore custom vars after Handlebars
        result = restoreCustomVars(result);
        return result;
    } catch (err) {
        console.error('Template String Resolution Error:', err);
        return `<div class="text-red-500 p-4 border border-red-300 rounded bg-red-50">
            <strong>Error Rendering Section:</strong><br/>
            ${String(err)}
        </div>`;
    }
};

// Process custom variables - render as editable inputs (editMode=true) or placeholders (editMode=false)
const processCustomVariables = (html: string, editMode: boolean = true, customVariables: Record<string, string> = {}): string => {
    if (editMode) {
        // Edit mode: render as editable inputs with auto-expand
        const autoResizeScript = `oninput="this.style.width = Math.max(80, this.value.length * 9 + 16) + 'px'"`;

        let textIdx = 0;
        html = html.replace(/\{\{customText\}\}/g, () => {
            const val = customVariables[`customText_${textIdx}`] || '';
            const width = Math.max(80, val.length * 9 + 16);
            textIdx++;
            return `<input type="text" class="custom-var-text" value="${val}" placeholder="..." ${autoResizeScript} style="display: inline; width: ${width}px; min-width: 80px; border: none; border-bottom: 2px solid #374151; padding: 2px 4px; margin: 0; background: #f9fafb; color: #374151; font-size: inherit; font-family: inherit; outline: none;" />`;
        });

        let currencyIdx = 0;
        html = html.replace(/\{\{customCurrency\}\}/g, () => {
            const val = customVariables[`customCurrency_${currencyIdx}`] || '';
            const width = Math.max(40, val.length * 9 + 16);
            currencyIdx++;
            return `<span style="display: inline-flex; align-items: center; margin: 0;"><span style="color: #374151; font-weight: 500;">$</span><input type="text" class="custom-var-currency" value="${val}" placeholder="0.00" ${autoResizeScript} style="display: inline; width: ${width}px; min-width: 40px; border: none; border-bottom: 2px solid #374151; padding: 2px 4px; margin: 0; background: #f9fafb; color: #374151; font-size: inherit; font-family: inherit; outline: none; text-align: right;" /></span>`;
        });

        let numberIdx = 0;
        html = html.replace(/\{\{customNumber\}\}/g, () => {
            const val = customVariables[`customNumber_${numberIdx}`] || '';
            const width = Math.max(40, val.length * 9 + 16);
            numberIdx++;
            return `<input type="text" class="custom-var-number" value="${val}" placeholder="0" ${autoResizeScript} style="display: inline; width: ${width}px; min-width: 40px; border: none; border-bottom: 2px solid #374151; padding: 2px 4px; margin: 0; background: #f9fafb; color: #374151; font-size: inherit; font-family: inherit; outline: none; text-align: right;" />`;
        });
    } else {
        // View mode: render as placeholder underlines (not editable)
        let textIdx = 0;
        html = html.replace(/\{\{customText\}\}/g, () => {
            const val = customVariables[`customText_${textIdx}`] || '&nbsp;';
            textIdx++;
            return `<span class="custom-var-placeholder" style="border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 80px;">${val}</span>`;
        });

        let currencyIdx = 0;
        html = html.replace(/\{\{customCurrency\}\}/g, () => {
            const val = customVariables[`customCurrency_${currencyIdx}`] || '&nbsp;';
            currencyIdx++;
            return `<span style="color: #374151;">$<span class="custom-var-placeholder" style="border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 40px;">${val}</span></span>`;
        });

        let numberIdx = 0;
        html = html.replace(/\{\{customNumber\}\}/g, () => {
            const val = customVariables[`customNumber_${numberIdx}`] || '&nbsp;';
            numberIdx++;
            return `<span class="custom-var-placeholder" style="border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 40px;">${val}</span>`;
        });
    }

    return html;
};

// Process line item variables - render as dropdowns (editMode=true) or placeholders (editMode=false)
const processLineItemVariables = (html: string, estimate: any, editMode: boolean = true, customVariables: Record<string, string> = {}): string => {
    const categories = [
        { name: 'lineItemLabor', key: 'labor', label: 'Labor Item' },
        { name: 'lineItemEquipment', key: 'equipment', label: 'Equipment Item' },
        { name: 'lineItemMaterial', key: 'material', label: 'Material Item' },
        { name: 'lineItemTool', key: 'tools', label: 'Tool Item' },
        { name: 'lineItemOverhead', key: 'overhead', label: 'Overhead Item' },
        { name: 'lineItemSubcontractor', key: 'subcontractor', label: 'Subcontractor Item' },
        { name: 'lineItemDisposal', key: 'disposal', label: 'Disposal Item' },
        { name: 'lineItemMiscellaneous', key: 'miscellaneous', label: 'Misc Item' },
    ];

    // We need a global index to match the frontend extraction logic which likely grabs all .line-item-select in order
    // But wait, the categories loop runs sequentially, and replace runs sequentially within that.
    // The frontend logic was: querySelectorAll('.line-item-select').forEach((select, idx) ...
    // So the index is global across ALL categories in the order they appear in the HTML.

    // To support global indexing, we need to process all categories in one pass or keep a global counter.
    // Since we are replacing category by category, we can't easily maintain a global index based on HTML position 
    // UNLESS we use a single regex for all of them or process them in order of appearance.
    // However, the current regex approach `forEach(cat ...)` processes by category type, not document order.
    // This is a disconnect with the frontend `idx` which is document order.

    // FIX: The frontend uses `querySelectorAll('.line-item-select')` which returns them in document order.
    // The backend processes them by category. If I have {{lineItemLabor}} then {{lineItemEquipment}} then {{lineItemLabor}},
    // the backend loop processes all Labors first, then Equipments.
    // So the backend replacement order DIFFERS from the frontend extraction order if categories are mixed.

    // To fix this correctly, we should probably construct a map of where each variable is, or just change the extraction logic 
    // to be more specific (e.g. data attribute). But I can't easily change the extraction logic without breaking the task flow too much.

    // ALTERNATIVE: Use a more robust keying strategy. The frontend assigns `data-variable-name` and use that for mapping? No, variable names aren't unique.

    // Let's rely on the `customVariables` simply being available.
    // I can't easily fix the index order issue without a bigger refactor (parsing the string for all tokens in order).
    // Let's implement the pre-fill assuming standard ordering (Category loop order) for now? 
    // NO, that will break persistence if mixed.

    // WAIT! The `customVariables` I saved in the previous step (Step 953) used `querySelectorAll` index.
    // And in Step 1007 (backend save), I used `replace(/<span class="line-item-placeholder".../g` to inject values.
    // That backend replacement regex finds them in STRING ORDER (which roughly equals DOM order).
    // So for the "View Mode" snapshot, the values are injected correctly in DOM order!

    // The problem is ONLY for "Edit Mode" pre-filling because I generate inputs via the Category Loop which splits them up.

    // To support accurate "Edit Mode" pre-fill, I need to know which global index corresponds to the token being replaced.
    // I can't know that easily in the category loop.

    // Helper function to process all placeholders in order?
    // We can use a regex that matches ANY of the line item variables.

    const allCategoriesRegex = new RegExp(`\\{\\{(lineItemLabor|lineItemEquipment|lineItemMaterial|lineItemTool|lineItemOverhead|lineItemSubcontractor|lineItemDisposal|lineItemMiscellaneous)\\}\\}`, 'g');

    let lineItemGlobalIdx = 0;
    html = html.replace(allCategoriesRegex, (match, categoryName) => {
        // Find which category config this matches
        const catConfig = categories.find(c => c.name === categoryName);
        if (!catConfig) return match;

        const items = estimate[catConfig.key] || [];

        if (editMode) {
            const savedValue = customVariables[`lineItem_${lineItemGlobalIdx}`]; // Value is the text description, closer to what I saved? 
            // Wait, frontend saved `selectedOption.text`. 
            // I need to match that to the option value (ID).
            // Since I saved the TEXT, I should select by text? 
            // Or better, update frontend to save ID (value) if possible?
            // Step 956 frontend code: `customVariables[\`lineItem_${idx}\`] = selectedOption?.text || '';`
            // Saving Text is safer for the "View Mode" snapshot (just text).
            // But for Edit Mode pre-fill, we need to match that Text to an Option.

            lineItemGlobalIdx++;

            if (items.length > 0) {
                const options = items.map((item: any) => {
                    const desc = item.description || item.labor || item.classification || item.item || `Item`;
                    // Check if this option matches the saved text
                    const isSelected = savedValue && desc === savedValue ? 'selected' : '';
                    return `<option value="${item._id}" ${isSelected}>${desc}</option>`;
                }).join('');

                return `<select class="line-item-select" data-category="${catConfig.key}" style="display: inline-block; min-width: 150px; padding: 2px 6px; margin: 0; border: 2px solid #3b82f6; border-radius: 4px; background: #eff6ff; color: #1e40af; font-weight: 500; cursor: pointer; font-size: inherit;">
                        <option value="">Select ${catConfig.label}...</option>
                        ${options}
                    </select>`;
            } else {
                return `<span style="display: inline-block; padding: 2px 6px; border: 1px dashed #d1d5db; border-radius: 4px; background: #f9fafb; color: #9ca3af; font-style: italic;">No ${catConfig.label}s</span>`;
            }
        } else {
            // View mode: show placeholder
            const savedValue = customVariables[`lineItem_${lineItemGlobalIdx}`];
            lineItemGlobalIdx++;
            const displayVal = savedValue || '&nbsp;';
            return `<span class="line-item-placeholder" style="border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 100px;">${displayVal}</span>`;
        }
    });

    return html;
};

export const resolveTemplate = (templateContent: string, estimate: IEstimate, editMode: boolean = true) => {
    const context = prepareContext(estimate);
    let html = resolveString(templateContent, context);
    // Cast customVariables to Record<string, string> or default to empty
    const customVars = (estimate as any).customVariables || {};
    html = processCustomVariables(html, editMode, customVars);
    html = processLineItemVariables(html, estimate, editMode, customVars);
    return html;
};

export const resolveTemplateDocument = (template: any, estimate: IEstimate, editMode: boolean = true) => {
    const context = prepareContext(estimate);
    const customVars = (estimate as any).customVariables || {};

    let html: string;
    if (template.pages && Array.isArray(template.pages) && template.pages.length > 0) {
        html = template.pages.map((page: any) => resolveString(page.content, context)).join('___PAGE_BREAK___');
    } else {
        // Fallback to single content
        html = resolveString(template.content || '', context);
    }

    // Post-process for custom and line item variables
    html = processCustomVariables(html, editMode, customVars);
    html = processLineItemVariables(html, estimate, editMode, customVars);

    return html;
};

export const getEmptyTemplate = () => ({
    _id: 'empty',
    title: 'Empty Template',
    pages: [{
        content: `<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);"> </strong></p><table><tbody><tr><td data-row="1"><strong style="color: rgb(0, 0, 0);">Proposal / Contract Number:</strong><span style="color: rgb(0, 0, 0);"> {{proposalNo}} </span></td><td data-row="1"><strong style="color: rgb(0, 0, 0);">Date: </strong><span style="color: rgb(0, 0, 0);">{{date}} </span></td></tr><tr><td data-row="2"><strong style="color: rgb(0, 0, 0);">Job Name:</strong><span style="color: rgb(0, 0, 0);"> {{projectTitle}} </span></td><td data-row="2"><strong style="color: rgb(0, 0, 0);">Job Address: </strong><span style="color: rgb(0, 0, 0);">{{jobAddress}} </span></td></tr></tbody></table><h2><br></h2><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);"><u>Customer Contact:</u></strong></p><p class="ql-align-justify">{{customerName}}</p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">{{contactPerson}} </span></p><p class="ql-align-justify">{{contactEmail}}</p><p class="ql-align-justify">{{contactPhone}}</p><h2><br></h2><p class="ql-align-center"><strong style="color: rgb(0, 0, 0);"><u>PROJECT SCOPE OF WORK</u></strong></p><p><br></p><p>Insert scope of work here...</p>`
    }],
    content: ''
});
