## Current Version: V.0.31
**Date:** December 17, 2025

### Overview
DevCo CRM is a comprehensive web application designed to streamline the estimation and proposal process for construction and service projects. Built on a modern stack (Next.js 15, MongoDB, TailwindCSS), it replaces legacy workflows with a fast, interactive, and integrated experience.

---

### Modules & Functionalities (V.0.31)

#### 1. Estimates Management
The core engine of the CRM, allowing for detailed project costing and tracking.
- **Estimate Dashboard**: A searchable, paginated list view of all estimates with status indicators (`Draft`, `Pending`, `Approved`).
- **Smart Creation & Versioning**: 
  - Generate new unique estimate numbers automatically.
  - **Project Name**: Added dedicated field for tracking project names alongside proposal numbers.
  - **Auto-Populate**: Automatically pulls Client Address and Key Contact info when a customer is selected.
  - **Clone Feature**: One-click duplication of estimates that increments the version number (e.g., `25-0635` → `25-0635-v2`), preserving the original data while allowing for revisions.
- **Interactive Calculator**:
  - **Accordion Layout**: Organize cost items by category (Labor, Equipment, Materials, etc.) in collapsible sections.
  - **Live Math**: Real-time calculation of Subtotals, Fringe Benefits (based on global constants), Profit Margin, and Grand Totals.
  - **Markup Control**: Adjustable bid markup percentage (Default: 30%) that dynamically updates the total margin.
  - **Service Flags**: Checkbox interface to define project scope (Directional Drilling, Potholing, etc.) which saves to the estimate metadata.
  - **Quick Add**: Search fields in "Add Item" modals now **auto-focus** for immediate typing.
- **Legacy Sync**: Built-in compatibility layer that synchronizes changes to the existing AppSheet backend to ensure data consistency across platforms.

#### 2. Proposal & Template Engine
A powerful system to turn raw estimates into professional, client-facing documents.
- **Template Management**:
  - **Rich Text Editor**: WYSIWYG editor for designing diverse proposal layouts.
  - **Dynamic Variables**:
    - **System Variables**: Auto-injects data like `{{customerName}}`, `{{projectTitle}}`, `{{grandTotal}}`.
    - **Custom Variables**: Supports `{{customText}}`, `{{customNumber}}`, and `{{customCurrency}}` for fields that need manual input during proposal generation.
  - **Dynamic Tables**: Placeholders like `{{lineItemLabor}}` automatically render a formatted list of labor items from the linked estimate.
  - **Management Actions**: Clone templates, edit inline descriptions, and manage template lifecycles.
- **Proposal Workflow**:
  - **Integration**: Select templates directly inside the Estimate Detail view.
  - **Edit Mode**: Interactive interface to fill in custom variables and select/deselect specific line items for the final output.
  - **Persistence**: All custom inputs are saved to MongoDB, ensuring no data loss upon page refresh.
  - **Snapshotting**: "Save" action freezes the proposal state into a static HTML snapshot, ensuring the sent proposal matches historical records.
  - **PDF Preview**: Dedicated modal to preview the final document and Print/Save as PDF.

#### 3. Catalogue System
Centralized database for all cost items.
- **Inventory Management**: CRUD (Create, Read, Update, Delete) support for all resources.
- **Categorization**: Dedicated tabs for Labor, Equipment, Materials, Tools, Overhead, Subcontractors, Disposal, Miscellaneous.
- **Search**: Instant filtering to quickly find and manage line items.

#### 4. Clients & Contacts Module
- **Client Dashboard**: View all client details, including a new **Related Contacts** section.
- **Contact Management**: Add/Edit contacts directly from the Client view.
- **Key Contacts**: Mark specific contacts as "Key Contact" to prioritize them during estimate auto-population.

#### 5. Constants & Settings
- Global configuration for essential calculations (e.g., Fringe Rates) ensuring consistent pricing across all estimates.

---

### Changelog

#### V.0.31 - Feature Release
*   **Estimate Enhancements**:
    *   **Project Name**: Added editable "Project Name" field to Estimate Header.
    *   **Address & Contact Sync**: Selecting a Client now auto-fills the Job Address and Key Contact Name.
    *   **Cloning**: Replaced "New" button with "Clone" button on estimate details to easily create V2, V3, etc.
    *   **UX Improvements**: 
        *   Added `autoFocus` to all "Add Item" search bars.
        *   Right-aligned numerical columns for better readability.
        *   Highlight full cell content on click for easier editing.
    *   **Default Markup**: New estimates now default to **30% Bid Markup**.
*   **Calculation Updates**:
    *   **Equipment**: 
        *   Added **Delivery & Pickup** field (Default: $300).
        *   Updated Formula: `(Qty × Times × Cost) + (Qty × Fuel) + (Qty × Delivery)`.
        *   Fixed persistence issue with "Times" field.
    *   **Overhead**: 
        *   Enforced logic: `Hours = Days × 8`.
        *   Total Formula: `Hours × Hourly Rate`.
*   **Client Management**:
    *   Introduced **Related Contacts** dashboard on Client Page.
    *   Added **Key Contact** flag to contacts for intelligent auto-selection.
