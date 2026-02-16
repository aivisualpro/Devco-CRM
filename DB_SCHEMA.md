# MongoDB Database Schema

## activities
**Routes**: `/api/activity`
_id: String
user: String
action: String
type: String
title: String
entityId: String
metadata: Object
createdAt: Date
updatedAt: Date

## clients
**Routes**: `/api/webhook/devcoBackend` (Actions: `getClients`, `addClient`, `updateClient`, `deleteClient`, `importClients`, `getClientById`), `/api/schedules`
_id: String
name: String
businessAddress: String
proposalWriter: String
contactFullName: String
email: String
phone: String
status: String
contacts: Array (ClientContact)
addresses: Array (Mixed)
documents: Array (ClientDocument)
createdAt: Date
updatedAt: Date

## constantItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getConstants`, `addConstant`, `updateConstant`, `deleteConstant`), `/api/constants`, `/api/favicon`, `/api/schedules`, `/api/djt`
_id: ObjectId
description: String
type: String
value: String
category: String
isActive: Boolean
createdAt: Date
updatedAt: Date

## counters
**Routes**: `/api/webhook/devcoBackend` (Internal use in `createEstimate`)
_id: String
seq: Number
year: Number
createdAt: Date
updatedAt: Date

## dailyjobtickets
**Routes**: `/api/djt`, `/api/email-djt`, `/api/quickbooks/projects/[id]/profitability`, `/api/webhook/devcoBackend` (Action: `importBillingTickets`)
_id: String
schedule_id: String
dailyJobDescription: String
customerPrintName: String
customerSignature: String
createdBy: String
clientEmail: String
emailCounter: Number
equipmentUsed: Array (EquipmentUsed)
djtimages: Array (String)
djtEmails: Array (EmailLog)
createdAt: Date
updatedAt: Date

## devcoChats
**Routes**: `/api/chat`, `/api/chat/[id]`
_id: ObjectId
sender: String
message: String
estimate: String
assignees: Array (Mixed)
replyTo: Object (ReplyTo)
createdAt: Date
updatedAt: Date

## devcoCompanyDocs
**Routes**: `/api/company-docs`
_id: ObjectId
title: String
url: String
r2Key: String
thumbnailUrl: String
type: String
uploadedBy: String
createdAt: Date
updatedAt: Date

## devcoDepartments
**Routes**: `/api/roles`
_id: String
name: String
description: String
managerId: String
parentDepartmentId: String
isActive: Boolean
createdAt: Date
updatedAt: Date

## devcoEmployees
**Routes**: `/api/webhook/devcoBackend` (Actions: `getEmployees`, `getEmployeeById`, `addEmployee`, `updateEmployee`, `deleteEmployee`, `importEmployees`), `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/set-password`, `/api/user/preferences`, `/api/roles`, `/api/schedules`
_id: String
firstName: String
lastName: String
email: String
phone: String
mobile: String
appRole: String
companyPosition: String
designation: String
isScheduleActive: Boolean
status: String
groupNo: String
hourlyRateSITE: Number
hourlyRateDrive: Number
dob: String
driverLicense: String
address: String
city: String
state: String
zip: String
password: String
applicationResume: String
dateHired: String
separationDate: String
separationReason: String
employeeHandbook: String
quickbooksW4I9DD: String
workforce: String
emergencyContact: String
dotRelease: String
dmvPullNotifications: String
drivingRecordPermission: String
backgroundCheck: String
copyOfDL: String
copyOfSS: String
lcpTracker: String
edd: String
autoInsurance: String
veriforce: String
unionPaperwork1184: String
profilePicture: String
signature: String
estimateSettings: Array (String)
reportFilters: Object
createdAt: Date
updatedAt: Date

## devcoPermissionAuditLogs
**Routes**: `/api/roles`
_id: ObjectId
action: String
targetType: String
targetId: String
targetName: String
changes: Mixed
performedBy: String
performedByName: String
ipAddress: String
userAgent: String
createdAt: Date

## devcoquickbooks
**Routes**: `/api/quickbooks/sync`, `/api/quickbooks/projects`, `/api/quickbooks/projects/[id]`, `/api/quickbooks/projects/[id]/profitability`, `/api/quickbooks/projects/[id]/transactions`, `/api/quickbooks/projects/[id]/proposal`
_id: ObjectId
projectId: String
project: String
customer: String
startDate: Date
endDate: Date
status: String
proposalNumber: String
manualOriginalContract: Number
manualChangeOrders: Number
transactions: Array (QuickBooksTransaction)
createdAt: Date
updatedAt: Date

## devcoRoles
**Routes**: `/api/roles`
_id: ObjectId
name: String
description: String
color: String
icon: String
isSystem: Boolean
isActive: Boolean
permissions: Array (ModulePermission)
createdBy: String
createdAt: Date
updatedAt: Date

## devcoschedules
**Routes**: `/api/schedules`, `/api/schedules/[id]`, `/api/webhook/schedules`, `/api/jha`, `/api/djt`, `/api/email-jha`, `/api/email-djt`, `/api/quickbooks/projects`, `/api/migrate-djt`
_id: String
title: String
fromDate: Date
toDate: Date
customerId: String
customerName: String
estimate: String
jobLocation: String
projectManager: String
foremanName: String
assignees: Array (String)
description: String
service: String
item: String
fringe: String
certifiedPayroll: String
notifyAssignees: String
perDiem: String
aerialImage: String
siteLayout: String
timesheet: Array (Timesheet)
jha: Object
djt: Object (DJT)
JHASignatures: Array (Mixed)
DJTSignatures: Array (Mixed)
todayObjectives: Array (Objective)
syncedToAppSheet: Boolean
isDayOffApproved: Boolean
createdAt: Date
updatedAt: Date

## devcoTasks
**Routes**: `/api/tasks`
_id: ObjectId
task: String
dueDate: Date
assignees: Array (String)
status: String
createdBy: String
createdAt: Date
lastUpdatedBy: String
lastUpdatedAt: Date

## devcoUserPermissionOverrides
**Routes**: `/api/roles`
_id: ObjectId
userId: String
module: String
grant: Array (String)
revoke: Array (String)
dataScope: String
fieldGrant: Array (FieldPermission)
fieldRevoke: Array (FieldPermission)
createdBy: String
createdAt: Date
updatedAt: Date

## disposalItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
disposalAndHaulOff: String
classification: String
subClassification: String
uom: String
cost: Number
createdAt: Date
updatedAt: Date

## djtsignatures
**Routes**: `/api/djt`
_id: String
schedule_id: String
employee: String
signature: String
createdBy: String
location: String
createdAt: Date
updatedAt: Date

## equipmentItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`), `/api/schedules`
_id: ObjectId
classification: String
subClassification: String
equipmentMachine: String
uom: String
supplier: String
dailyCost: Number
weeklyCost: Number
monthlyCost: Number
tax: Number
createdAt: Date
updatedAt: Date

## estimatesdb
**Routes**: `/api/webhook/devcoBackend` (Actions: `getEstimates`, `getEstimateById`, `createEstimate`, `updateEstimate`, `deleteEstimate`, etc.), `/api/schedules`, `/api/debug`, `/api/quickbooks/projects`, `/api/quickbooks/projects/[id]/proposal`
_id: String
estimate: String
date: String
customer: String
customerName: String
customerId: String
contactName: String
contactId: String
contactEmail: String
contactPhone: String
contactAddress: String
extension: String
jobAddress: String
projectTitle: String
projectName: String
proposalNumber: String
status: String
notes: String
fringe: String
bidMarkUp: String
proposalWriter: Mixed
certifiedPayroll: String
prevailingWage: Boolean
isChangeOrder: Boolean
parentVersionId: String
aerialImage: String
siteLayout: String
createdBy: String
customerJobNumber: String
customerPONumber: String
workRequestNumber: String
subContractAgreementNumber: String
dirNumber: String
accountingContact: String
accountingEmail: String
accountingPhone: String
PoORPa: String
poName: String
PoAddress: String
PoPhone: String
ocName: String
ocAddress: String
ocPhone: String
subCName: String
subCAddress: String
subCPhone: String
liName: String
liAddress: String
liPhone: String
scName: String
scAddress: String
scPhone: String
bondNumber: String
projectId: String
fbName: String
fbAddress: String
eCPRSystem: String
customerPONo: String
workRequestNo: String
subContractAgreementNo: String
customerJobNo: String
DIRProjectNo: String
wetUtilities: String
dryUtilities: String
projectDescription: String
estimatedStartDate: String
estimatedCompletionDate: String
siteConditions: String
prelimAmount: String
billingTerms: String
otherBillingTerms: String
usaNumber: String
receiptsAndCosts: Array (ReceiptItem)
signedContracts: Array (SignedContract)
syncedToAppSheet: Boolean
labor: Array (Object)
equipment: Array (Object)
material: Array (Object)
tools: Array (Object)
overhead: Array (Object)
subcontractor: Array (Object)
disposal: Array (Object)
miscellaneous: Array (Object)
services: Array (String)
subTotal: Number
margin: Number
grandTotal: Number
versionNumber: Number
templateId: String
proposal: Object
proposals: Array (ProposalMeta)
customVariables: Object
jobPlanningDocs: Array (JobPlanningDoc)
billingTickets: Array (BillingTicket)
coiDocument: Object
legalDocs: Array (LegalDoc)
intentToLien: Array (IntentToLien)
releases: Array (Release)
createdAt: Date
updatedAt: Date

## globalCustomVariables
**Routes**: `/api/webhook/devcoBackend` (Actions: `getGlobalCustomVariables`, `saveGlobalCustomVariables`)
_id: ObjectId
name: String
label: String
type: String
defaultValue: String
createdAt: Date
updatedAt: Date

## jhas
**Routes**: `/api/jha`, `/api/email-jha`, `/api/schedules`
_id: String
schedule_id: String
date: Date
jhaTime: String
usaNo: String
subcontractorUSANo: String
operatingMiniEx: Boolean
operatingAVumTruck: Boolean
excavatingTrenching: Boolean
acConcWork: Boolean
operatingBackhoe: Boolean
workingInATrench: Boolean
trafficControl: Boolean
roadWork: Boolean
operatingHdd: Boolean
confinedSpace: Boolean
settingUgBoxes: Boolean
otherDailyWork: Boolean
commentsOtherDailyWork: String
sidewalks: Boolean
commentsOnSidewalks: String
heatAwareness: Boolean
commentsOnHeatAwareness: String
ladderWork: Boolean
commentsOnLadderWork: String
overheadLifting: Boolean
commentsOnOverheadLifting: String
materialHandling: Boolean
commentsOnMaterialHandling: String
roadHazards: Boolean
commentsOnRoadHazards: String
heavyLifting: Boolean
commentsOnHeavyLifting: String
highNoise: Boolean
commentsOnHighNoise: String
pinchPoints: Boolean
commentsOnPinchPoints: String
sharpObjects: Boolean
commentsOnSharpObjects: String
trippingHazards: Boolean
commentsOnTrippingHazards: String
otherJobsiteHazards: Boolean
commentsOnOther: String
anySpecificNotes: String
stagingAreaDiscussed: Boolean
rescueProceduresDiscussed: Boolean
evacuationRoutesDiscussed: Boolean
emergencyContactNumberWillBe911: Boolean
firstAidAndCPREquipmentOnsite: Boolean
closestHospitalDiscussed: Boolean
nameOfHospital: String
addressOfHospital: String
createdBy: String
clientEmail: String
emailCounter: Number
jhaEmails: Array (EmailLog)
createdAt: Date
updatedAt: Date

## jhasignatures
**Routes**: `/api/jha`
_id: String
schedule_id: String
employee: String
signature: String
createdBy: String
location: String
createdAt: Date
updatedAt: Date

## laborItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
classification: String
subClassification: String
fringe: String
basePay: Number
wCompPercent: Number
payrollTaxesPercent: Number
createdAt: Date
updatedAt: Date

## materialItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
material: String
classification: String
subClassification: String
supplier: String
uom: String
cost: Number
taxes: Number
createdAt: Date
updatedAt: Date

## miscellaneousItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
item: String
classification: String
uom: String
cost: Number
quantity: Number
createdAt: Date
updatedAt: Date

## overheadItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`), `/api/schedules`, `/api/djt`, `/api/migrate-djt`, `/api/quickbooks/projects/[id]/profitability`
_id: ObjectId
overhead: String
classification: String
subClassification: String
hourlyRate: Number
dailyRate: Number
createdAt: Date
updatedAt: Date

## subcontractorItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
subcontractor: String
classification: String
subClassification: String
uom: String
cost: Number
quantity: Number
createdAt: Date
updatedAt: Date

## templates
**Routes**: `/api/webhook/devcoBackend` (Actions: `getTemplates`, `addTemplate`, `updateTemplate`, `deleteTemplate`, `cloneTemplate`)
_id: ObjectId
title: String
subTitle: String
subTitleDescription: String
content: String
pages: Array (Page)
version: Number
isCurrent: Boolean
customVariables: Array (Variable)
status: String
services: Array (String)
coverImage: String
createdAt: Date
updatedAt: Date

## tokens
**Routes**: `/api/auth/quickbooks/callback`
_id: ObjectId
service: String
accessToken: String
refreshToken: String
realmId: String
expiresAt: Date
refreshTokenExpiresAt: Date
createdAt: Date
updatedAt: Date

## toolItems
**Routes**: `/api/webhook/devcoBackend` (Actions: `getCatalogueItems`, `getAllCatalogueItems`, `addCatalogueItem`, `updateCatalogueItem`, `deleteCatalogueItem`)
_id: ObjectId
tool: String
classification: String
subClassification: String
supplier: String
uom: String
cost: Number
taxes: Number
createdAt: Date
updatedAt: Date

## vehicleDocs
**Routes**: `/api/vehicle-docs`
_id: ObjectId
unit: String
unitNumber: String
vinSerialNumber: String
documents: Array (VehicleDocument)
createdAt: Date
updatedAt: Date

