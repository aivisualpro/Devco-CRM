# API Route Audit: Unbounded .find() calls

| File | Line | Snippet | Needs Pagination |
|---|---|---|---|
| `app/api/webhooks/quickbooks/test/route.ts` | 22 | `const dbProjects = await DevcoQuickBooks.find({` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/schedules/route.ts` | 199 | `const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();` | Yes (.limit missing) |
| `app/api/webhook/schedules/route.ts` | 229 | `const assigneeDocs = await Employee.find({ email: { $in: docAny.assignees } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 551 | `const estimates = await Estimate.find({ customerId })` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 615 | `const matchedClients = await Client.find({ name: regex }).select('_id').lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 713 | `const dataQuery = Estimate.find(query).select(selectFields).sort(mongoSort).skip(skip).limit(limit);` | No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 782 | `Constant.find().lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 783 | `Employee.find({ status: { $ne: 'Inactive' } }).select('_id name email profileImage status').lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 784 | `Client.find().select('_id name businessAddress').lean()` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 947 | `const estimates = await Estimate.find({ estimate: estimateNumber }).sort({ createdAt: 1 }).lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1013 | `const existingEstimates = await Estimate.find({ estimate: { $regex: regex } })` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1148 | `const allVersions = await Estimate.find({ estimate: sourceEst.estimate })` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1211 | `const existingEstimates = await Estimate.find({ estimate: { $regex: regex } })` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1289 | `const existingCOs = await Estimate.find({ _id: { $regex: regex } })` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1540 | `const otherCOs = await Estimate.find({` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1566 | `const allVersions = await Estimate.find({` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 1592 | `const childCOs = await Estimate.find({ parentVersionId: oldId, isChangeOrder: true }).lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1633 | `const allEmployees = await Employee.find({}).select('firstName lastName email _id').lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 1877 | `const clients = await Client.find({ _id: { $in: Array.from(customerIds) } }).lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2002 | `const items = await Model.find().sort({ createdAt: -1 }).lean();` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2018 | `EquipmentItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2019 | `LaborItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2020 | `MaterialItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2021 | `OverheadItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2022 | `SubcontractorItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2023 | `DisposalItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2024 | `MiscellaneousItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2025 | `ToolItem.find().sort({ createdAt: -1 }).lean(),` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2026 | `Constant.find().sort({ createdAt: -1 }).lean()` | Yes (.limit missing) |
| `app/api/webhook/devcoBackend/route.ts` | 2129 | `const items = await Constant.find().sort({ createdAt: -1 });` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 2173 | `const clients = await Client.find().sort({ name: 1 });` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 2557 | `const items = await Template.find().sort({ createdAt: -1 });` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 2623 | `const vars = await GlobalCustomVariable.find().sort({ createdAt: 1 });` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 2632 | `const updated = await GlobalCustomVariable.find().sort({ createdAt: 1 });` | Yes (.limit missing) / No .lean() |
| `app/api/webhook/devcoBackend/route.ts` | 2800 | `const employees = await Employee.find(empFilter)` | Yes (.limit missing) |
| `app/api/vendors-sub-contractors/route.ts` | 14 | `const docs = await VendorsSubContractors.find().sort({ name: 1 }).lean();` | Yes (.limit missing) |
| `app/api/vendor-subs-docs/route.ts` | 16 | `const docs = await VendorSubsDoc.find({ estimate }).sort({ createdAt: -1 }).lean();` | Yes (.limit missing) |
| `app/api/vehicle-docs/route.ts` | 31 | `const docs = await VehicleDoc.find().sort({ createdAt: -1 }).lean();` | Yes (.limit missing) |
| `app/api/tasks/route.ts` | 38 | `DevcoTask.find(query)` | Yes (.limit missing) |
| `app/api/tasks/route.ts` | 89 | `const assigneeDocs = await Employee.find({ email: { $in: taskData.assignees } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 81 | `Schedule.find(query)` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 336 | `const results = await Schedule.find().sort({ fromDate: -1, _id: 1 }).lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 343 | `const results = await Schedule.find({ estimate: estimateNumber })` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 404 | `const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 445 | `const assigneeDocs = await Employee.find({ email: { $in: docAny.assignees } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 791 | `const assigneeDocs = await Employee.find({ email: { $in: docAny.assignees || [] } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 989 | `const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1012 | `const assigneeDocs = await Employee.find({ email: { $in: docAny.assignees } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1458 | `const schedules = await Schedule.find({ "timesheet.0": { $exists: true } }).lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1497 | `const schedules = await Schedule.find({ "timesheet.0": { $exists: true } }).lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1569 | `const results = await Schedule.find(filters).select('fromDate').lean();` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1819 | `!skipInitialData ? Client.find().select('name _id').sort({ name: 1 }).lean() : Promise.resolve([]),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1820 | `!skipInitialData ? Employee.find({ status: { $ne: 'Inactive' } }).select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive address ssNumber').lean() : Promise.resolve([]),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1827 | `!skipInitialData ? EquipmentItem.find().select('equipmentMachine dailyCost uom classification').sort({ equipmentMachine: 1 }).lean() : Promise.resolve([]),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 1828 | `!skipInitialData ? OverheadItem.find().sort({ overhead: 1 }).lean() : Promise.resolve([])` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 2008 | `Client.find().select('name _id').sort({ name: 1 }).lean(),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 2009 | `Employee.find({ status: { $ne: 'Inactive' } }).select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive address ssNumber').lean(),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 2016 | `EquipmentItem.find().select('equipmentMachine dailyCost uom classification').sort({ equipmentMachine: 1 }).lean(),` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 2017 | `OverheadItem.find().sort({ overhead: 1 }).lean()` | Yes (.limit missing) |
| `app/api/schedules/route.ts` | 2591 | `const schedules = await Schedule.find({ 'timesheet.0': { $exists: true } }).lean();` | Yes (.limit missing) |
| `app/api/roles/route.ts` | 37 | `const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();` | Yes (.limit missing) |
| `app/api/roles/route.ts` | 174 | `const allRoles = await Role.find().select('_id name').lean();` | Yes (.limit missing) |
| `app/api/quickbooks/sync/route.ts` | 179 | `const overheads = await OverheadItem.find({}).lean();` | Yes (.limit missing) |
| `app/api/quickbooks/sync/route.ts` | 186 | `const schedules = await (Schedule as any).find(` | Yes (.limit missing) |
| `app/api/quickbooks/projects/route.ts` | 14 | `const projects = await DevcoQuickBooks.find({})` | Yes (.limit missing) |
| `app/api/quickbooks/projects/route.ts` | 28 | `const allRelatedEstimates = await Estimate.find(` | Yes (.limit missing) |
| `app/api/quickbooks/projects/[id]/profitability/route.ts` | 37 | `const overheads = await OverheadItem.find({}).lean();` | Yes (.limit missing) |
| `app/api/quickbooks/projects/[id]/profitability/route.ts` | 45 | `const schedules = await Schedule.find({` | Yes (.limit missing) |
| `app/api/quickbooks/projects/[id]/profitability/route.ts` | 52 | `const standaloneDjts = await DailyJobTicket.find({` | Yes (.limit missing) |
| `app/api/prelim-docs/route.ts` | 30 | `const docs = await PrelimDoc.find({ estimate }).sort({ createdAt: -1 }).lean();` | Yes (.limit missing) |
| `app/api/pre-bore-logs/route.ts` | 24 | `const schedules = await Schedule.find(` | Yes (.limit missing) / No .lean() |
| `app/api/pre-bore-logs/route.ts` | 328 | `const schedules = await Schedule.find(` | Yes (.limit missing) |
| `app/api/pre-bore-logs/route.ts` | 384 | `const schedules = await Schedule.find(` | Yes (.limit missing) / No .lean() |
| `app/api/notifications/route.ts` | 34 | `col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),` | No .lean() |
| `app/api/migration/fix-timesheet-timezone/route.ts` | 67 | `const schedules = await Schedule.find(query).lean();` | Yes (.limit missing) |
| `app/api/migrate-djt/route.ts` | 11 | `const overheads = await OverheadItem.find({}).lean();` | Yes (.limit missing) |
| `app/api/migrate-djt/route.ts` | 23 | `const schedules = await Schedule.find({ djt: { $ne: null } });` | Yes (.limit missing) / No .lean() |
| `app/api/jha/route.ts` | 235 | `const signatures = await JHASignature.find({ schedule_id: (jha as any).schedule_id });` | Yes (.limit missing) / No .lean() |
| `app/api/fix-djt/route.ts` | 23 | `const schedules = await db.collection('devcoschedules').find({` | Yes (.limit missing) / No .lean() |
| `app/api/email-bot/route.ts` | 27 | `const employees = await Employee.find().select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/email-bot/route.ts` | 44 | `const schedules = await Schedule.find({` | Yes (.limit missing) |
| `app/api/djt/route.ts` | 35 | `const equipmentItems = await EquipmentItem.find().lean();` | Yes (.limit missing) |
| `app/api/djt/route.ts` | 143 | `const estSchedules = await Schedule.find({ estimate: filterEstimate }, { _id: 1 }).lean();` | Yes (.limit missing) |
| `app/api/djt/route.ts` | 166 | `const schedules = await Schedule.find({ _id: { $in: scheduleIds } }).lean();` | Yes (.limit missing) |
| `app/api/customizations/route.ts` | 35 | `let results = await Customization.find().sort({ category: 1, label: 1 }).lean();` | Yes (.limit missing) |
| `app/api/customizations/route.ts` | 40 | `results = await Customization.find().sort({ category: 1, label: 1 }).lean();` | Yes (.limit missing) |
| `app/api/cron/daily-summary/route.ts` | 36 | `const employees = await Employee.find().select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/cron/daily-summary/route.ts` | 52 | `const schedules = await Schedule.find({` | Yes (.limit missing) |
| `app/api/constants/route.ts` | 19 | `const constants = await Constant.find(filter).sort({ value: 1 });` | Yes (.limit missing) / No .lean() |
| `app/api/company-docs/route.ts` | 31 | `const docs = await DevcoCompanyDoc.find().sort({ createdAt: -1 }).lean();` | Yes (.limit missing) |
| `app/api/chat/route.ts` | 137 | `const assigneeDocs = await Employee.find({ email: { $in: assignees } }).select('email firstName lastName').lean();` | Yes (.limit missing) |
| `app/api/app-settings/route.ts` | 26 | `const settings = await Constant.find({ type: SETTINGS_TYPE });` | Yes (.limit missing) / No .lean() |
