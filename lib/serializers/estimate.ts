import { QBO_OWNED_FIELDS, DEVCO_OWNED_FIELDS, MERGE_RULES } from '@/lib/qbo-sync-contract';

export function serializeEstimate(estimateDoc: any, qbDoc: any = null) {
    if (!estimateDoc) return null;
    
    // Base serialization (convert from mongoose doc or lean object to POJO)
    let base = estimateDoc.toObject ? estimateDoc.toObject() : { ...estimateDoc };
    
    // Ensure id fields are strings
    if (base._id) base._id = base._id.toString();
    if (base.customerId) base.customerId = base.customerId.toString();

    // If we have QuickBooks overlay data, apply the merge logic
    if (qbDoc) {
        // QBO fields pass through EXCEPT where DEVCO owns them
        const qbOverlay = qbDoc.toObject ? qbDoc.toObject() : { ...qbDoc };

        // Copy all fields from QBO as a baseline overlay (only the ones we track from QB)
        for (const field of QBO_OWNED_FIELDS) {
            if (qbOverlay[field] !== undefined) {
                base[field] = qbOverlay[field];
            }
        }
        
        // Handle MERGE_RULES
        if (MERGE_RULES.transactions === 'replaceAll' && qbOverlay.transactions) {
            base.transactions = qbOverlay.transactions;
        }
        
        if (MERGE_RULES.proposalNumber === 'fillOnlyIfEmpty') {
            if (!base.proposalNumber && qbOverlay.proposalNumber) {
                base.proposalNumber = qbOverlay.proposalNumber;
            }
        }

        // DEVCO_OWNED_FIELDS are strictly driven by the DevcoQuickBooks model ONLY if we want them overlaid?
        // Wait, the prompt says: "Merge: estimate fields override QB fields ONLY for DEVCO_OWNED_FIELDS. All other QB fields show through."
        // That means DEVCO_OWNED_FIELDS from the Estimate doc are preserved?
        // Wait! "If the field is in DEVCO_OWNED_FIELDS, save it to the DevcoQuickBooks document (NOT the Estimate), so the next QB sync will preserve it."
        // That means DEVCO_OWNED_FIELDS are stored in DevcoQuickBooks!
        // "Merge: estimate fields override QB fields ONLY for DEVCO_OWNED_FIELDS... All other QB fields show through."
        // Actually, let's overlay DEVCO_OWNED_FIELDS from qbOverlay onto the base if they exist in qbOverlay.
        for (const field of DEVCO_OWNED_FIELDS) {
            if (qbOverlay[field] !== undefined) {
                base[field] = qbOverlay[field];
            }
        }
    }
    
    return base;
}
