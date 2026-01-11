## Current Version: V.0.65


#### V.0.65 - Signature PDF Insertion & Document Integration
*Timestamp: January 11, 2026*

*   **Signature PDF Insertion**:
    *   **Robust Rendering**: Fixed the critical issue where signatures were not appearing in generated PDFs. Implemented a marker-based strategy in `googleService.ts` to find and swap placeholders for high-resolution images.
    *   **Automation**: Signatures are now correctly scaled and positioned in real-time during document generation.
    *   **Cleanup Logic**: Automated removal of temporary image files and remaining `{{...}}` placeholders for a polished final document.

*   **Proposal & Certified Payroll Documents**:
    *   **New Templates**: Integrated core templates for industry-standard compliance:
        *   **20 Day Prelim**: Automated generation of Preliminary 20-Day Notices.
        *   **Conditional Release (Progress)**: Integrated progress payment release forms.
    *   **Expanded Data Mapping**: Added support for comprehensive document variables including Owner, Contractor, and Sub-Contractor details.

*   **Data Models & Logic**:
    *   **New Field**: Added `usaNumber` to the Estimates database (`Estimatesdb`) and UI.
    *   **Variables**: Integrated `{{usaNumber}}` into the Google Docs PDF generation pipeline.
    *   **Version Increment**: System-wide version updated to V.0.65.
    *   **API Stability**: Resolved Google Docs API schema errors (`deleteContentRange`) for reliable batch updates.


#### V.0.64 - Date Range Filters & Persistence
*Timestamp: January 6, 2026*

*   **QuickBooks Advanced Filtering**:
    *   **New Date Range Filters**: Added "This Year", "Last Year", and "This Month" options to the QuickBooks Projects Dashboard.
    *   **Filter Persistence**: The selected date range filter is now automatically saved to `localStorage`, ensuring the view remains consistent across browser sessions.
    *   **Live Data Filtering**: Integrated date range logic into all financial data retrieval, allowing for more precise summary cards and project analysis.
    *   **Enhanced Financial Accuracy**: Refined how invoices and purchases are filtered by date to ensure the "Overview" and "Summary" tabs reflect the user's selected period.

*   **System & CI/CD**:
    *   **Version Increment**: System-wide version updated to V.0.64.
    *   **Git Automation**: Implemented automated commit and push workflows for documentation and code updates.


#### V.0.62 - QuickBooks Integration & Authentication Cleanup
*Timestamp: January 6, 2026*

*   **QuickBooks Projects Dashboard**:
    *   **Real Financial Data**: Projects now display actual Income and Costs fetched from QuickBooks Invoices, Purchases, and Bills.
    *   **Automatic Token Refresh**: Implemented auto-persistence of QuickBooks OAuth refresh tokens to `.env.local`, eliminating manual token updates.
    *   **Profit Margin Calculation**: Real-time calculation of profit margins based on live invoice and expense data.
    *   **Improved Loading UX**: Replaced spinner with animated Rocket icon for a more engaging loading experience.
    *   **Layout Alignment**: Content padding now aligns consistently with header navigation.
    *   **Newest First Sorting**: Projects are now sorted by creation date (newest to oldest) by default.

*   **Authentication Simplification**:
    *   **Removed Social Login**: Eliminated Google and Apple sign-in buttons from the login page for a cleaner, email-focused authentication flow.

*   **Performance Optimizations**:
    *   **Bulk Financial Fetch**: Single API calls fetch all invoices and expenses, mapping them to projects efficiently instead of per-project queries.


#### V.0.60 - Payroll Automation & UI Refinement
*Timestamp: December 25, 2025*

*   **Payroll & Report Upgrades**:
    *   **Double Time Implementation**: Introduced a new "Double Time" category for automated payroll calculations, applied to hours exceeding 12 per shift.
    *   **Smart Audit Trail**: Enhanced the Payroll Audit Trail modal to dynamically calculate and display correct rates for Regular, Overtime (1.5x), and Double Time (2.0x).
    *   **Extended Detail View**: Audit trail now correctly filters and displays site entries for the newly introduced Double Time category.
*   **Time Card Management**:
    *   **Visual Type Indicators**: Replaced text labels for "Type" with intuitive icons (Truck for Drive, MapPin for Site) in the Time Cards table.
    *   **UI Optimization**: Reduced row heights and padding in the Time Cards view for a more compact, data-dense display.
    *   **Sorting Logic**: Implemented numerical week sorting (descending) in the sidebar for faster navigation across the calendar year.
*   **Data Consistency Fixes**:
    *   **Timesheet Persistence**: Resolved critical issue where manualDistance and manualDuration overrides were not correctly saving to MongoDB.
    *   **ID Matching Robustness**: Enhanced the handleSaveEdit logic to use robust ID matching across both Payroll and Time Card pages, ensuring edits are always applied to the correct record.

#### V.0.58 - Smart Constants & Documentation
*Timestamp: December 21, 2025*

*   **Smart Constants Management**:
    *   **Multiple Type Selection**: Users can now select multiple types (e.g., "Fringe" + "Labor") when creating a new constant.
    *   **Batch Creation**: The system automatically generates separate constant entries for each selected type in a single action.
    *   **Intelligent Validation**: Implemented a per-type duplicate check that strictly prevents creating a constant if its description already exists within that specific type, while successfully creating the non-duplicate ones.
    *   **New Item Shortcut**: Integrated a "New Item" shortcut within the type selector for rapid category creation.

*   **Schedule Module Upgrades**:
    *   **Advanced Filtering**: Introduced powerful sidebar filters allowing users to drill down by Estimate #, Client, Employee, Service, Tag, and Per Diem usage.
    *   **Infinite Scroll**: Replaced pagination with an optimized "load on scroll" experience, allowing for unlimited browsing of schedule cards without page reloads.
    *   **Enhanced Job Details**: Redesigned the right-hand details column for better readability:
        *   **Inline Metadata**: Services and Tags are now displayed in a single, compact row.
        *   **Smart Assignees**: Employee chips now include names and role icons.
        *   **Layout Optimization**: "Project Scope / Notes" moved to the bottom for better information hierarchy, and dates now strictly follow local time formatting.


#### V.0.57 - Extended Schema & Smart Contacts
*Timestamp: December 20, 2025*

*   **Estimates & Data Schema**:
    *   **Expanded Data Model**: Added comprehensive fields to Estimates including `Customer Job Number`, `Accounting Contact`, `Billing Terms`, `Project Description`, `Site Conditions`, and specialized contact roles (Owner's Contact, Lender's Inspector, etc.).
    *   **Extension Support**: Added `extension` field to both Estimates and Client Contacts for better phone number management.
    *   **Client Management Enhancements**:
    *   **Contact Extensions**: Updated Client Detail and Edit views to support phone extensions ("Ext").
    *   **Smart Formatting**: Implemented auto-formatting for phone numbers `(555) 123-4567` across Client and Employee forms.
    *   **Import Logic**: Refined `importClients` to sync `Extension` fields (supporting "Ext" and "Extension" headers) and map legacy Accounting contacts correctly.
*   **Document Management & Storage**:
    *   **Cloudflare R2 Integration**: Implemented secure, high-performance object storage for all client and project documents using Cloudflare R2.
    *   **Multi-File Uploads**: Enhanced `DocumentGallery` to support drag-and-drop multiple file uploads.
    *   **Smart Thumbnails**: Added automatic thumbnail generation for images and PDFs, with specialized icons for other file types (Word, Excel, etc.).
    *   **Gallery Redesign**: Refined the Document Gallery with tabbed filtering (All, PDF, Image, Doc, Sheets) for better organization.
*   **Import System**:
    *   **Enhanced Mapping**: Updated `importEstimates` to handle all new schema fields.
    *   **Intelligent Sync**: Backend now checks and syncs Accounting Contacts to the Client record during Estimate imports if they don't exist.

#### V.0.56 - Schedule Cards Redesign & Dynamic Favicon
*Timestamp: December 19, 2025 00:06 PKT*

*   **Schedule Page Enhancements**:
    *   **Day-of-Week Filter Tabs**: Added BadgeTabs above schedule cards with "All", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" options. Each tab shows the count of schedules for that day. Selecting a day filters the displayed cards.
    *   **Timezone Fix**: Resolved critical bug where dates were shifted by one day due to UTC conversion. Now uses local timezone consistently for date display and day-of-week calculations.
    *   **Schedule Card Redesign**:
        *   **Row 1**: Tag icon (from Constants with image/color/letter priority) + Full customer name (wraps instead of truncating).
        *   **Row 2**: Title with reduced font size (`text-sm sm:text-base`).
        *   **Row 3**: Job Location.
        *   **Row 4**: Estimate # (blue pill badge) + Description snippet.
        *   **Row 5**: Left - Assignees avatars (profile images or initials). Right - Service/Fringe/CP/NA/PD badges from Constants.
        *   **Row 6**: Left - Clock icon + Date (no label). Right - PM/Foreman/SD avatars with profile images or role labels.
    *   **Tag/Attribute Badges**: All badges (Service, Fringe, Certified Payroll, Notify Assignees, Per Diem) now look up their images/colors from Constants by description.
    *   **Edit Modal Layout**: Reorganized Description & Scope (2/3 width left) with PM/Foreman/SD stacked vertically (1/3 width right). Added proper spacing to Service/Tag row.

*   **Dynamic Favicon**:
    *   Created `/api/favicon` endpoint that fetches "SITE Favicon" from Constants collection.
    *   Supports base64 data URLs and external image URLs.
    *   Falls back to default `devco-logo-v3.png` if constant not found.
    *   Favicon cached for 1 hour for performance.

*   **SearchableSelect Component Fixes**:
    *   **Value Highlighting**: Fixed issue where dropdowns would highlight the next value instead of "-" when "-" was selected.
    *   **Edit Mode Fix**: When editing records, dropdown now properly highlights the existing value instead of resetting to "-".
    *   **Search Filter**: When searching, maintains highlight on current value if it exists in filtered results.

#### V.0.55 - Integrated Job Scheduling Module
*   **Module Launch: Job Schedules**:
    *   Launched a high-performance **Schedule Page** (`/jobs/schedules`) with premium neumorphic design.
    *   Implemented full CRUD (Create, Read, Update, Delete) with optimized MongoDB operations.
    *   **Intelligent Import**: Developed a custom CSV parser with automated header detection and data type casting (Boolean, Array).
    *   **System Integration**: Real-time linking with Clients, Estimates, Employees, and Job Constants.
    *   **Interactive UI**: Card-based timeline layout with team assignee visualization and keyboard shortcuts (`Cmd/Ctrl + Shift + A`).
    *   **Data Integrity**: Server-side de-duplication of lookup data for PMs, Foremen, and Estimates.

#### V.0.50 - Brand Refresh & Identity Overhaul
*   **New Brand Identity**:
    *   **Primary Brand Color**: Shifted to a sophisticated dark navy blue `#0F4C75`, replacing generic Indigo/Blue-600 references.
    *   **Custom Typography**: Integrated the **'BBH Hegarty'** Google Font specifically for the DEVCO logo in the global header.
    *   **Premium Gradients**: Applied new brand gradients (`#0F4C75` $\rightarrow$ `#3282B8`) to all primary buttons (Add, Send, Clone, Save) and high-visibility UI components.
*   **UI/UX Refinements**:
    *   **Tab System Overhaul**: Updated `BadgeTabs`, `PillTabs`, and `UnderlineTabs` to use the brand color and gradient for active states, including refined shadows and count badges.
    *   **Communication Refresh**: 
        *   Updated the **Chat Widget** and **Chat Modal** with the brand theme.
        *   Refined outgoing message bubbles with brand gradients.
        *   Sidebar active states now feature consistent brand gradients and shadows.
    *   **Search & Navigation**: Search result hover states and dropdown indicators updated to brand color.
    *   **Search & Navigation**: Search result hover states and dropdown indicators updated to brand color.


#### V.0.49 - Estimates Table Overhaul & Import Optimization
*   **Estimates Table Overhaul**:
    *   **Strategic Reordering**: Reordered columns for better workflow flow: Estimate, Version, Date, Customer, Writer, Fringe, CP, Services, Sub, %, Margin, Total, Status, Actions.
    *   **Brevity & Names**: Shortened headers (e.g., "Grand Total" $\rightarrow$ "Total", "Markup%" $\rightarrow$ "%") for better visibility on smaller screens.
    *   **Natural Sorting**: Implemented natural sort for estimate numbers and robust date parsing logic.
    *   **Visual Consistency**: Status, Fringe, and CP badges now pull hex colors directly from system constants, matching the Estimate Detail view.
    *   **Proposal Writer Profiles**: Displaying employee profile pictures or initials directly in the table for quick identification.
*   **CSV Import Enhancements**:
    *   **Robust FSM Parser**: New parser handles multi-line fields, escaped quotes, and commas within fields accurately.
    *   **Advanced Data Sync**: 
        *   Supports new fields: Fringe, CP, and Proposal Writer.
        *   Composite key upserts (Estimate + Version) ensure historical accuracy.
        *   Optimized backend client sync using concurrent fetching and bulk operations.
*   **UI/UX Improvements**:
    *   **Integrated Constants**: Moved Search and "Add Constant" buttons to the global header, streamlining the Constants management workspace.
    - **Actions Cleanup**: Removed redundant eye icon; clicking a row remains the primary navigation.
    *   **Currency Alignment**: Consistent right-alignment for all financial columns.



**Date:** December 18, 2025


### Overview
DevCo CRM is a comprehensive web application designed to streamline the estimation and proposal process for construction and service projects. Built on a modern stack (Next.js 15, MongoDB, TailwindCSS), it replaces legacy workflows with a fast, interactive, and integrated experience.

---

### Modules & Functionalities (V.0.41)


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
- **Dynamic Header Buttons** (NEW):
  - **Services**: Shows count of selected services on a blue (#0066FF) background with white text.
  - **Status**: Icon turns white on reference color background when status is selected.
  - **Markup %**: Displays percentage with liquid fill animation that rises based on value, with color gradient from light blue to dark navy.
  - **Fringe Rate**: Icon turns white on reference color background when rate is selected.
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

#### 4. Clients Management
- **Client Dashboard**: View all client details, business addresses, and contact persons.
- **Unified Profile**: All essential client data (Email, Phone, Address) is managed directly within the client profile.


#### 5. Constants & Settings
- Global configuration for essential calculations (e.g., Fringe Rates) ensuring consistent pricing across all estimates.

#### 6. Devco Communication (NEW)
A real-time internal communication system tailored for Devco CRM.
- **Chat Widget**: A floating, interactive entry point accessible from any page within the application.
- **Unified Chat Modal**:
    - **Proposals Chat**: Automatically generated chat rooms for every estimate/proposal to discuss project-specific details.
    - **Global Channels**: Pre-seeded channels (`General`, `Projects`, `Urgent`) and the ability for users to create new custom channels.
    - **Direct Messaging**: Direct communication lines with all active employees.
- **System Integration**: Fetches live data from Estimates and Employees to keep the sidebar up-to-date.
- **Rich Interaction**: Supports search across conversations, message history, and UI placeholders for mentions and attachments.
- **Data Persistence**: All messages are stored in a dedicated MongoDB collection with timestamps and sender attribution.


---

### Changelog

#### V.0.41 - Profile Pictures & Employee Enhancements

*   **Employee Profile Pictures**:
    *   **Cloudinary Integration**: Implemented secure image storage using Cloudinary.
    *   **Smart Uploads**: Employees can now upload profile pictures which are automatically cropped (face-gravity), resized to 500x500px, and optimized for web performance.
    *   **Fallback Avatar**: System automatically generates a colored "Initials Avatar" (e.g., "JD" for John Doe) if no picture is uploaded.
*   **Employee List Improvements**:
    *   **Visual Roster**: Added profile picture/avatar column to the main Employee List table.
    *   **Pagination Fix**: Resolved issue where search filters would return empty results if not on Page 1. Filters now auto-reset pagination.
    *   **Interaction Fix**: Fixed "Edit" and "Delete" actions mistakenly triggering row navigation.
*   **Estimate Header Enhancements**:
    *   **Visual Proposal Writer**:
        *   Selecting a "Proposal Writer" now replaces the generic icon with the employee's specific Profile Picture or Initials Avatar.
        *   Dropdown list upgraded to show employee faces/avatars for easier selection.

#### V.0.38 - System Simplification & Optimization
*   **Module Removal**: 
    *   **Contacts Module Retired**: Completely removed the standalone Contacts module. Contact information is now unified within the Clients module for a more streamlined CRM experience.
    *   **UI Cleanup**: Removed Contacts from global navigation, Estimate headers, and Client dashboards.
    *   **Codebase Optimization**: Deleted `Contact` database models, API controllers, and associated UI components to reduce system complexity.
*   **Searchable Select Improvements**: 
    *   Enhanced z-index management and layout persistence for dropdowns to prevent overlapping in the estimate header.
    *   Refined auto-focus behavior to prevent accidental triggering of multiple selects.

#### V.0.37 - Devco Communication System

*   **Devco Communication Infrastructure**:
    *   **Core API**: Implemented `/api/communication` to handle message retrieval, sending, channel creation, and sidebar data fetching.
    *   **Database Integration**: Created `Message`, `Channel`, and `DevcoCommunicationDb` structure in MongoDB.
*   **Chat Components**:
    *   **ChatWidget**: Added a sleek, animated floating button with notification pulse.
    *   **ChatModal**: A comprehensive communication center featuring:
        *   **Dynamic Sidebar**: Searchable lists of Estimates, Channels, and Employees.
        *   **Message Interface**: Responsive chat window with bubble-style messages, sender labels, and timestamps.
        *   **Channel Management**: Built-in functionality to create new channels via the UI.
    *   **Rich UI Aesthetics**: used Glassmorphism effects, Indigo theme consistency, and auto-scrolling message lists.
*   **Data Models**:
    *   Defined robust schemas for `Message` and `Channel` including sender mapping and target categorization (proposal, channel, direct).

#### V.0.32 - Estimate Header UI Overhaul

*   **Dynamic Header Buttons**:
    *   **Services Button**: Now shows the count of selected services (white text) on a solid #0066FF blue background instead of an icon.
    *   **Status Button**: Background fills with the reference color from constants; icon turns white when a status is selected.
    *   **Markup % Button**: 
        *   Replaced inline input with an icon button that opens a neumorphic popup.
        *   Displays percentage value with **liquid fill animation** that rises from the bottom.
        *   Dynamic color gradient based on percentage (10% increments from #CCE0FF to #001433).
    *   **Fringe Rate Button**: Background fills with reference color; icon turns white when selected.
*   **Fringe Rate Fix**: 
    *   Fixed critical bug where Fringe Rate selection was not saving to MongoDB.
    *   Issue was caused by click-outside handler interfering with dropdown selection.
    *   Implemented dedicated `handleFringeChange` handler for reliable state updates.
*   **AppSheet Sync**: Temporarily disabled AppSheet synchronization on estimate updates to prevent timeout errors.
*   **UI Polish**:
    *   Added `Percent` and `HardHat` icons from lucide-react.
    *   Aligned all header buttons (Services, Status, Markup, Fringe) in a consistent 2x2 grid.
    *   Added CSS keyframe animation `liquidRise` for smooth fill effect.

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
