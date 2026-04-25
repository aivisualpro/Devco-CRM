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
| [ ] | `getCatalogueItems` | READ | `API /api/catalogue` |  |
| [ ] | `getAllCatalogueItems` | READ | `API /api/catalogue` |  |
| [ ] | `getCatalogueCounts` | READ | `API /api/catalogue` |  |
| [ ] | `addCatalogueItem` | WRITE | `API /api/catalogue` |  |
| [ ] | `updateCatalogueItem` | WRITE | `API /api/catalogue` |  |
| [ ] | `deleteCatalogueItem` | DELETE | `API /api/catalogue` |  |
| [ ] | `addLineItem` | WRITE | `API /api/catalogue` |  |
| [ ] | `updateLineItem` | WRITE | `API /api/catalogue` |  |
| [ ] | `deleteLineItem` | DELETE | `API /api/catalogue` |  |
| [ ] | `getConstants` | READ | `API /api/catalogue` |  |
| [ ] | `addConstant` | WRITE | `API /api/catalogue` |  |
| [ ] | `updateConstant` | WRITE | `API /api/catalogue` |  |
| [ ] | `deleteConstant` | DELETE | `API /api/catalogue` |  |
| [ ] | `getClients` | READ | `GET /api/clients` |  |
| [ ] | `addClient` | WRITE | `POST/PATCH/DELETE /api/clients` |  |
| [ ] | `updateClient` | WRITE | `POST/PATCH/DELETE /api/clients` |  |
| [ ] | `deleteClient` | DELETE | `POST/PATCH/DELETE /api/clients` |  |
| [ ] | `importClients` | WRITE | `POST/PATCH/DELETE /api/clients` |  |
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
| [ ] | `getEmployees` | READ | `GET /api/employees` | MUST redact password - see BLOCKER 1 |
| [ ] | `getEmployeeById` | READ | `GET /api/employees` |  |
| [ ] | `addEmployee` | WRITE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `updateEmployee` | WRITE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `deleteEmployee` | DELETE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `importEmployeeCertifications` | WRITE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `importEmployeeDocuments` | WRITE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `importDrugTestingRecords` | WRITE | `API /api/misc` |  |
| [ ] | `importEmployees` | WRITE | `POST/PATCH/DELETE /api/employees` |  |
| [ ] | `importReceiptsAndCosts` | WRITE | `API /api/misc` |  |
| [ ] | `importPlanningDocs` | WRITE | `API /api/misc` |  |
| [ ] | `updateReceiptsAndCosts` | WRITE | `API /api/misc` |  |
| [ ] | `importBillingTickets` | WRITE | `API /api/misc` |  |
