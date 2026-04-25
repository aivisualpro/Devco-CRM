# Database Index Audit

## 1. Current Indexes

| Model | Field(s) | Index Type | Unique? |
|---|---|---|---|
| Activity | `_id` | Primary Key | Yes |
| Activity | `createdAt` | Single Field | No |
| Activity | `type` | Single Field | No |
| Activity | `user` | Single Field | No |
| Activity | `user, createdAt` | Compound | No |
| Chat | `_id` | Primary Key | Yes |
| Chat | `assignees` | Single Field | No |
| Chat | `createdAt` | Single Field | No |
| Chat | `estimate` | Single Field | No |
| Client | `_id` | Primary Key | Yes |
| Constant | `_id` | Primary Key | Yes |
| Counter | `_id` | Primary Key | Yes |
| Customization | `_id` | Primary Key | Yes |
| Customization | `key` | Single Field | Yes |
| DailyJobTicket | `_id` | Primary Key | Yes |
| DevcoCompanyDoc | `_id` | Primary Key | Yes |
| DevcoQuickBooks | `_id` | Primary Key | Yes |
| DevcoQuickBooks | `projectId` | Single Field | Yes |
| DevcoTask | `_id` | Primary Key | Yes |
| DisposalItem | `_id` | Primary Key | Yes |
| DJTSignature | `_id` | Primary Key | Yes |
| Employee | `_id` | Primary Key | Yes |
| EquipmentInspection | `_id` | Primary Key | Yes |
| EquipmentItem | `_id` | Primary Key | Yes |
| Estimate | `_id` | Primary Key | Yes |
| Estimate | `createdAt` | Single Field | No |
| Estimate | `customerId` | Single Field | No |
| Estimate | `estimate` | Single Field | No |
| Estimate | `status` | Single Field | No |
| Estimate | `updatedAt` | Single Field | No |
| GlobalCustomVariable | `_id` | Primary Key | Yes |
| GlobalCustomVariable | `name` | Single Field | Yes |
| JHA | `_id` | Primary Key | Yes |
| JHASignature | `_id` | Primary Key | Yes |
| LaborItem | `_id` | Primary Key | Yes |
| MaterialItem | `_id` | Primary Key | Yes |
| MiscellaneousItem | `_id` | Primary Key | Yes |
| Notification | `_id` | Primary Key | Yes |
| Notification | `createdAt` | Single Field | No |
| Notification | `recipientEmail` | Single Field | No |
| Notification | `recipientEmail, read, createdAt` | Compound | No |
| OverheadItem | `_id` | Primary Key | Yes |
| PotholeLog | `_id` | Primary Key | Yes |
| PreBoreLog | `_id` | Primary Key | Yes |
| PrelimDoc | `_id` | Primary Key | Yes |
| PrelimDoc | `estimate` | Single Field | No |
| Role | `_id` | Primary Key | Yes |
| Role | `name` | Single Field | Yes |
| Role | `performedBy, createdAt` | Compound | No |
| Role | `targetType, targetId, createdAt` | Compound | No |
| Role | `userId` | Single Field | No |
| Role | `userId, module` | Compound | Yes |
| Schedule | `_id` | Primary Key | Yes |
| Schedule | `assignees` | Single Field | No |
| Schedule | `customerId` | Single Field | No |
| Schedule | `foremanName` | Single Field | No |
| Schedule | `fromDate` | Single Field | No |
| Schedule | `projectManager` | Single Field | No |
| SubcontractorItem | `_id` | Primary Key | Yes |
| Template | `_id` | Primary Key | Yes |
| Token | `_id` | Primary Key | Yes |
| Token | `service` | Single Field | Yes |
| ToolItem | `_id` | Primary Key | Yes |
| Usa811Ticket | `_id` | Primary Key | Yes |
| Usa811Ticket | `legacyId` | Single Field | No |
| Usa811Ticket | `ticketNo` | Single Field | No |
| VehicleDoc | `_id` | Primary Key | Yes |
| VendorsSubContractors | `_id` | Primary Key | Yes |
| VendorSubsDoc | `_id` | Primary Key | Yes |
| VendorSubsDoc | `estimate` | Single Field | No |
| WebhookLog | `_id` | Primary Key | Yes |
| WebhookLog | `receivedAt` | Single Field | No |

## 2. Unindexed Queried Fields
The following fields are queried via `.find()`, `.findOne()`, etc. in `/app/api/**` but lack a dedicated or compound index covering them.

| Model | Unindexed Field |
|---|---|
| Client | `name` |
| Constant | `type` |
| Constant | `value` |
| DailyJobTicket | `schedule_id` |
| Employee | `email` |
| Employee | `status` |
| Estimate | `isChangeOrder` |
| Estimate | `parentVersionId` |
| Estimate | `shareToken` |
| Estimate | `oldId` |
| Schedule | `estimate` |
| Schedule | `djt._id` |
| Template | `services` |
| VehicleDoc | `unitNumber` |
| VehicleDoc | `vinSerialNumber` |
| WebhookLog | `source` |
