// Fields owned by QuickBooks — overwritten on every sync.
export const QBO_OWNED_FIELDS = [
  'project', 'customer', 'startDate', 'status', 
  'income', 'qbCost'
] as const;

// Fields owned by DEVCO CRM — MUST be preserved through every sync.
// Adding a new custom field? Add it here too.
export const DEVCO_OWNED_FIELDS = [
  'manualOriginalContract', 'manualChangeOrders', 
  'proposalNumber',           // also has "only-if-empty" rule, see below
  'devcoCost',                // computed from Schedules during sync
] as const;

// Fields that need merge logic (not pure overwrite, not pure preserve)
export const MERGE_RULES = {
  proposalNumber: 'fillOnlyIfEmpty',
  transactions: 'replaceAll',  // QB is source of truth for transactions
                               // If you ever add custom fields TO a transaction,
                               // change this to a merge-by-transactionId strategy.
} as const;
