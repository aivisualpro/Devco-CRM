# DevcoBackend API Migration Inventory

| Status | Action | Type | Target Route | Notes |
|---|---|---|---|---|
| [x] | `getEstimatesByCustomerId` | READ | `GET /api/estimates` |  |
| [x] | `getEstimates` | READ | `GET /api/estimates` |  |
| [x] | `getEstimatesPageData` | READ | `GET /api/estimates` |  |
| [x] | `getEstimateStats` | READ | `GET /api/estimates` |  |
| [x] | `getEstimateById` | READ | `GET /api/estimates` |  |
| [x] | `getEstimateBySlug` | READ | `GET /api/estimates` |  |
| [x] | `getEstimatesByProposal` | READ | `GET /api/estimates` |  |
| [x] | `createEstimate` | WRITE | `POST/PATCH/DELETE /api/estimates` |  |

| [x] | `cloneEstimate` | WRITE | `POST/PATCH/DELETE /api/estimates` |  |
| [x] | `copyEstimate` | WRITE | `POST/PATCH/DELETE /api/estimates` |  |
| [x] | `createChangeOrder` | WRITE | `API /api/misc` |  |
| [x] | `updateEstimate` | WRITE | `POST/PATCH/DELETE /api/estimates` |  |

| [x] | `deleteEstimate` | DELETE | `POST/PATCH/DELETE /api/estimates` |  |
| [x] | `importEstimates` | WRITE | `POST/PATCH/DELETE /api/estimates` |  |
| [x] | `getCatalogueItems` | READ | `API /api/catalogue` |  |
| [x] | `getAllCatalogueItems` | READ | `API /api/catalogue` |  |
| [x] | `getCatalogueCounts` | READ | `API /api/catalogue` |  |
| [x] | `addCatalogueItem` | WRITE | `API /api/catalogue` |  |
| [x] | `updateCatalogueItem` | WRITE | `API /api/catalogue` |  |
| [x] | `deleteCatalogueItem` | DELETE | `API /api/catalogue` |  |
| [x] | `addLineItem` | WRITE | `API /api/catalogue` |  |
| [x] | `updateLineItem` | WRITE | `API /api/catalogue` |  |
| [x] | `getClients` | READ | `GET /api/clients` |  |
| [x] | `getClientById` | READ | `GET /api/clients/[id]` |  |
| [x] | `addClient` | WRITE | `POST /api/clients` |  |
| [x] | `updateClient` | WRITE | `PATCH /api/clients/[id]` |  |
| [x] | `deleteClient` | DELETE | `DELETE /api/clients/[id]` |  |
| [x] | `importClients` | WRITE | `POST /api/clients/import` |  |
| [x] | `deleteLineItem` | DELETE | `API /api/catalogue` |  |
| [x] | `getConstants` | READ | `API /api/catalogue` |  |
| [x] | `addConstant` | WRITE | `API /api/catalogue` |  |
| [x] | `updateConstant` | WRITE | `API /api/catalogue` |  |
| [x] | `deleteConstant` | DELETE | `API /api/catalogue` |  |
| [ ] | `uploadDocument` | WRITE | `API /api/misc` |  |
| [ ] | `uploadThumbnail` | WRITE | `API /api/misc` |  |
| [ ] | `uploadRawToCloudinary` | WRITE | `API /api/misc` |  |
| [ ] | `deleteCloudinaryFiles` | DELETE | `API /api/misc` |  |
| [ ] | `deleteDocumentFiles` | DELETE | `API /api/misc` |  |
| [ ] | `getClientById` | READ | `GET /api/clients` |  |
| [ ] | `getTemplates` | READ | `API /api/catalogue` |  |
| [ ] | `addTemplate` | WRITE | `API /api/catalogue` |  |
| [ ] | `updateTemplate` | WRITE | `API /api/catalogue` |  |
| [ ] | `deleteTemplate` | DELETE | `API /api/catalogue` |  |
| [ ] | `cloneTemplate` | WRITE | `API /api/catalogue` |  |
| [ ] | `getGlobalCustomVariables` | READ | `API /api/misc` |  |
| [ ] | `saveGlobalCustomVariables` | WRITE | `API /api/misc` |  |
| [ ] | `previewProposal` | READ | `API /api/misc` |  |
| [ ] | `generateProposal` | WRITE | `API /api/misc` |  |
| [ ] | `generateProposalFromPages` | WRITE | `API /api/misc` |  |
| [x] | `getEmployees` | READ | `GET /api/employees` | MUST redact password - see BLOCKER 1 |
| [x] | `getEmployeeById` | READ | `GET /api/employees/[id]` |  |
| [x] | `addEmployee` | WRITE | `POST /api/employees` |  |
| [x] | `updateEmployee` | WRITE | `PATCH /api/employees/[id]` |  |
| [x] | `deleteEmployee` | DELETE | `DELETE /api/employees/[id]` |  |
| [x] | `importEmployeeCertifications` | WRITE | `POST /api/employees/certifications` |  |
| [x] | `importEmployeeDocuments` | WRITE | `POST /api/employees/documents` |  |
| [x] | `importEmployees` | WRITE | `POST /api/employees/import` |  |
| [ ] | `importDrugTestingRecords` | WRITE | `API /api/misc` |  |
| [ ] | `importReceiptsAndCosts` | WRITE | `API /api/misc` |  |
| [ ] | `importPlanningDocs` | WRITE | `API /api/misc` |  |
| [ ] | `updateReceiptsAndCosts` | WRITE | `API /api/misc` |  |
| [ ] | `importBillingTickets` | WRITE | `API /api/misc` |  |
