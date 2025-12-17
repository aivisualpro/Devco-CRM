# Documentation, Changelog and Knowledgebase

## Current Version: V.0.3
**Date:** December 17, 2025

### Overview
DevCo CRM is a comprehensive web application designed to streamline the estimation and proposal process for construction and service projects. Built on a modern stack (Next.js 15, MongoDB, TailwindCSS), it replaces legacy workflows with a fast, interactive, and integrated experience.

---

### Modules & Functionalities (V.0.3)

#### 1. Estimates Management
The core engine of the CRM, allowing for detailed project costing and tracking.
- **Estimate Dashboard**: A searchable, paginated list view of all estimates with status indicators (`Draft`, `Pending`, `Approved`).
- **Smart Creation & Versioning**: 
  - Generate new unique estimate numbers automatically.
  - **Clone Feature**: One-click duplication of estimates that increments the version number (e.g., `25-0635` → `25-0635-v2`), preserving the original data while allowing for revisions.
- **Interactive Calculator**:
  - **Accordion Layout**: Organize cost items by category (Labor, Equipment, Materials, etc.) in collapsible sections.
  - **Live Math**: Real-time calculation of Subtotals, Fringe Benefits (based on global constants), Profit Margin, and Grand Totals.
  - **Markup Control**: Adjustable bid markup percentage that dynamically updates the total margin.
  - **Service Flags**: Checkbox interface to define project scope (Directional Drilling, Potholing, etc.) which saves to the estimate metadata.
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
- **Categorization**: Dedicated tabs for:
  - Labor
  - Equipment
  - Materials
  - Tools
  - Overhead
  - Subcontractors
  - Disposal
  - Miscellaneous
- **Search**: Instant filtering to quickly find and manage line items.

#### 4. Contacts Module
- Customer database management.
- Link customers to estimates for auto-population of address and contact fields.

#### 5. Constants & Settings
- Global configuration for essential calculations (e.g., Fringe Rates) ensuring consistent pricing across all estimates.

---

### Changelog

**Next Version: V.0.31**
*(Pending updates...)*
