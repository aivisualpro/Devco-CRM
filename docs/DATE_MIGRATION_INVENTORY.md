# Date Migration Inventory

[BUCKET B] ./app/(protected)/clients/[id]/components.tsx:454:                                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
[BUCKET B] ./app/(protected)/clients/[id]/components.tsx:495:                        Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'Unknown date'}
[BUCKET C] ./app/(protected)/clients/[id]/page.tsx:671:        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
[BUCKET B] ./app/(protected)/settings/general/page.tsx:1267:                                                        Last sent: {new Date(emailBotLastSent).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} PST
[BUCKET A] ./app/(protected)/settings/general/page.tsx:1473:                                                    <p className="text-[11px] text-slate-400"><strong className="text-slate-500">Subject:</strong> {emailBotSubject} — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
[BUCKET C] ./app/(protected)/estimates/EstimatesTable.tsx:535:        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `;
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:76:    return d.toLocaleDateString('en-US');
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:161:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:173:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:497:            const todayDate = new Date().toLocaleDateString('en-US');
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:510:                    return !isNaN(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : String(val);
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:526:                    if (liveGT && liveGT > 0) return `$${liveGT.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:528:                    if (gt) { const n = parseFloat(String(gt).replace(/[^0-9.-]+/g, '')); return !isNaN(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''; }
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:636:                date: localeDateString(target.date) || new Date().toLocaleDateString(),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:637:                day: new Date(target.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' })
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:722:                date: new Date(selectedJHA.date || new Date()).toLocaleDateString() 
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:951:                date: localeDateString(selectedDJT.date || schedule?.fromDate) || new Date().toLocaleDateString(),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:952:                day: (toLocalDate(selectedDJT.date || schedule?.fromDate) || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:998:                setNewPotholeLog({ date: format(new Date(), 'yyyy-MM-dd'), estimate: '', projectionLocation: '', potholeItems: [], createdBy: '' });
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1027:                setNewPreBoreLog({ date: format(new Date(), 'yyyy-MM-dd'), customerForeman: '', customerWorkRequestNumber: '', startTime: '', addressBoreStart: '', addressBoreEnd: '', devcoOperator: '', drillSize: '', pilotBoreSize: '', soilType: '', boreLength: '', pipeSize: '', preBoreLogs: [], createdBy: '' });
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1158:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1385:        fromDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1386:        toDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1387:        dueDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1404:            fromDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1405:            toDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1406:            dueDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1425:            fromDate: item.fromDate || format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1426:            toDate: item.toDate || format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1427:            dueDate: item.dueDate || format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1519:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1604:    const [billingTicketSentDateValue, setBillingTicketSentDateValue] = useState(format(new Date(), 'yyyy-MM-dd'));
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1608:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1622:        setBillingTicketSentDateValue(format(new Date(), 'yyyy-MM-dd'));
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1657:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1706:        let safeDate = format(new Date(), 'yyyy-MM-dd');
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1767:                    const todayStr = new Date().toLocaleDateString('en-US');
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:1773:                        ? `$${parseFloat(String(ticketData.lumpSum).replace(/[^0-9.-]+/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2212:                date: localeDateString(formData.date) || new Date().toLocaleDateString(),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2213:                today: new Date().toLocaleDateString(),
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2271:                        return `$${liveGT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2277:                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2376:                    const formatted = !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : releaseItem.amountOfCheck;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2388:                        variables.disputedClaims = `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2425:                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2439:                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val;
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2451:                    variables.day = billingItem.date ? format(toLocalDate(billingItem.date) || new Date(), 'EEEE') : format(new Date(), 'EEEE');
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2455:                    variables.lumpSum = rawLumpSum ? `$${parseFloat(rawLumpSum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
[BUCKET B] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:2775:                                                            {new Date(msg.createdAt).toLocaleString([], {
[BUCKET B] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:3371:                                                                            {doc.generatedDate || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '')}
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:3535:                                                ${parseFloat(String(item.lumpSum || item.amount).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:3669:                                                    ${parseFloat(String(item.amountOfCheck || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/estimates/[slug]/components/EstimateDocsCard.tsx:3677:                                                    ${parseFloat(String(item.disputedClaims || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/estimates/[slug]/components/CostBreakdownChart.tsx:33:        `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
[BUCKET C] ./app/(protected)/estimates/[slug]/components/VersionTimeline.tsx:38:        `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:97:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:115:        paymentDate: format(new Date(), 'yyyy-MM-dd')
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:205:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:212:            paymentDate: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:247:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:269:            date: receipt.date || format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:298:                paymentDate: receiptsAndCosts[index].paymentDate || format(new Date(), 'yyyy-MM-dd')
[BUCKET C] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:377:                                        <p className="text-[11px] font-black text-pink-600 leading-none">${rects.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
[BUCKET C] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:381:                                        <p className="text-[11px] font-black text-indigo-600 leading-none">${invs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
[BUCKET C] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:385:                                        <p className="text-[12px] font-black text-[#0F4C75] leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
[BUCKET C] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:428:                                                ${(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET A] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:777:                                                paymentDate: format(new Date(), 'yyyy-MM-dd')
[BUCKET C] ./app/(protected)/estimates/[slug]/components/ReceiptsCard.tsx:844:                                    <span>{(selectedReceipt.amount || 0).toLocaleString()}</span>
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateScheduleCard.tsx:176:                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString(),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateScheduleCard.tsx:177:                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/EstimateScheduleCard.tsx:568:                         const variables: any = { ...selectedJHA, customerName: schedule?.customerName, date: selectedJHA.date || new Date().toLocaleDateString() };
[BUCKET A] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:90:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:191:        setNewContract({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', attachments: [] });
[BUCKET A] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:201:            date: contract.date || format(new Date(), 'yyyy-MM-dd'),
[BUCKET C] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:264:                                        <p className="text-[12px] font-black text-[#0F4C75] leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
[BUCKET A] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:272:                                setNewContract({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', attachments: [] });
[BUCKET C] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:297:                                        ${(contract.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/estimates/[slug]/components/SignedContractsCard.tsx:483:                                    ${(selectedViewContract.amount || 0).toLocaleString()}
[BUCKET A] ./app/(protected)/docs/billing-tickets/page.tsx:87:    const [sentDateValue, setSentDateValue] = useState(format(new Date(), 'yyyy-MM-dd'));
[BUCKET A] ./app/(protected)/docs/billing-tickets/page.tsx:222:        setSentDateValue(format(new Date(), 'yyyy-MM-dd'));
[BUCKET A] ./app/(protected)/docs/billing-tickets/page.tsx:347:                today: new Date().toLocaleDateString(),
[BUCKET C] ./app/(protected)/docs/billing-tickets/page.tsx:379:                lumpSum: ticket.lumpSum ? `$${parseFloat(String(ticket.lumpSum).replace(/[^0-9.-]+/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '',
[BUCKET A] ./app/(protected)/docs/billing-tickets/page.tsx:521:                        const todayStr = new Date().toLocaleDateString('en-US');
[BUCKET C] ./app/(protected)/docs/billing-tickets/page.tsx:527:                            ? `$${parseFloat(String(data.lumpSum).replace(/[^0-9.-]+/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
[BUCKET B] ./app/(protected)/docs/vehicle-equipment/page.tsx:495:                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown date'}
[BUCKET A] ./app/(protected)/docs/pothole-logs/[id]/page.tsx:278:            a.download = `Pothole_Log_${estimate?.estimate || log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
[BUCKET A] ./app/(protected)/docs/pothole-logs/page.tsx:316:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/docs/equipment-inspection/[id]/page.tsx:154:            a.download = `Equipment_Inspection_${record?.equipment || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
[BUCKET A] ./app/(protected)/docs/equipment-inspection/page.tsx:150:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/docs/equipment-inspection/page.tsx:356:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/docs/equipment-inspection/page.tsx:523:            a.download = `Equipment_Inspection_${record.equipment || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
[BUCKET C] ./app/(protected)/docs/receipts-costs/page.tsx:601:                                    const amtFormatted = receipt.amount ? `$${(typeof receipt.amount === 'number' ? receipt.amount : parseFloat(String(receipt.amount))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
[BUCKET C] ./app/(protected)/docs/receipts-costs/page.tsx:719:                                                        {receipt.amount ? `$${(typeof receipt.amount === 'number' ? receipt.amount : parseFloat(receipt.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
[BUCKET B] ./app/(protected)/docs/jha/components/JHACard.tsx:157:                    <span className="text-[11px] font-medium text-slate-500 shrink-0">{jha.createdAt ? new Date(jha.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
[BUCKET A] ./app/(protected)/docs/jha/page.tsx:264:            jhaTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
[BUCKET A] ./app/(protected)/docs/jha/page.tsx:411:                day: new Date(target.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/docs/jha/page.tsx:509:                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET B] ./app/(protected)/docs/job-tickets/components/DJTCard.tsx:184:                    <span className="text-[10px] font-medium text-slate-500 shrink-0">{djt.createdAt ? new Date(djt.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
[BUCKET A] ./app/(protected)/docs/job-tickets/page.tsx:272:            djtTime: scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
[BUCKET A] ./app/(protected)/docs/job-tickets/page.tsx:459:            day: new Date(targetDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/docs/job-tickets/page.tsx:700:                                Job Ticket — {(actionSheetItem.date || actionSheetItem.scheduleRef?.fromDate) ? new Date(actionSheetItem.date || actionSheetItem.scheduleRef?.fromDate || new Date()).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
[BUCKET B] ./app/(protected)/docs/company-docs/page.tsx:189:                                                            Added {new Date(doc.createdAt).toLocaleDateString()}
[BUCKET A] ./app/(protected)/docs/pre-bore-logs/[id]/page.tsx:282:            a.download = `Pre_Bore_Log_${log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
[BUCKET A] ./app/(protected)/docs/pre-bore-logs/page.tsx:416:            const dateStr = log.date ? formatWallDate(log.date) : format(new Date(), 'yyyy-MM-dd');
[BUCKET A] ./app/(protected)/docs/pre-bore-logs/page.tsx:457:            date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./app/(protected)/docs/pre-bore-logs/page.tsx:793:            a.download = `Pre_Bore_Log_${log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
[BUCKET B] ./app/(protected)/mobile-docs/vehicle-equipment/page.tsx:146:                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown date'}
[BUCKET A] ./app/(protected)/dashboard/components/ScheduleDetailModal.tsx:79:        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
[BUCKET A] ./app/(protected)/dashboard/components/ScheduleDetailModal.tsx:334:                                    {toUTCDate(schedule.fromDate)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
[BUCKET A] ./app/(protected)/dashboard/components/ScheduleDetailModal.tsx:390:                                        {toUTCDate(schedule.fromDate)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
[BUCKET B] ./app/(protected)/dashboard/_components/TaskList.tsx:83:                                {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
[BUCKET A] ./app/(protected)/dashboard/page.tsx:222:            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
[BUCKET B] ./app/(protected)/dashboard/page.tsx:314:                                        {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
[BUCKET A] ./app/(protected)/dashboard/page.tsx:1532:                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/dashboard/page.tsx:1614:                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET B] ./app/(protected)/dashboard/page.tsx:1714:            date: selectedDJT.createdAt ? new Date(selectedDJT.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
[BUCKET B] ./app/(protected)/dashboard/page.tsx:1715:            day: new Date(selectedDJT.createdAt || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/dashboard/page.tsx:3173:                                                            jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }),
[BUCKET C] ./app/(protected)/dashboard/widgets/EstimateStatsWidget.tsx:46:                        <span className="font-semibold text-slate-900 ml-auto">${Math.round(d.total).toLocaleString()}</span>
[BUCKET B] ./app/(protected)/templates/page.tsx:342:                                                <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown Date'}</span>
[BUCKET A] ./app/(protected)/jobs/time-cards/TimeCardContent.tsx:105:            return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
[BUCKET C] ./app/(protected)/jobs/time-cards/TimeCardContent.tsx:2085:                                                {year.totalHours.toLocaleString()}
[BUCKET C] ./app/(protected)/jobs/schedules/SchedulesTable.tsx:1064:            return date.toLocaleString('en-US', {
[BUCKET A] ./app/(protected)/jobs/schedules/SchedulesTable.tsx:1221:                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/jobs/schedules/SchedulesTable.tsx:1332:                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString(),
[BUCKET A] ./app/(protected)/jobs/schedules/SchedulesTable.tsx:1333:                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/(protected)/jobs/schedules/SchedulesTable.tsx:2647:                                                jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }),
[BUCKET A] ./app/(protected)/jobs/schedules/components/TimesheetModal.tsx:29:        return new Date(dateInput).toLocaleString('en-US', {
[BUCKET B] ./app/(protected)/jobs/schedules/components/JHAModal.tsx:376:                                                        <span className="text-[10px] text-slate-500 shrink-0">{new Date(email.createdAt).toLocaleDateString()}</span>
[BUCKET B] ./app/(protected)/jobs/schedules/components/JHAModal.tsx:547:                                                {new Date(sig.createdAt || Date.now()).toLocaleString('en-US', { 
[BUCKET B] ./app/(protected)/jobs/schedules/components/ChangeOfScopeModal.tsx:204:                                        <span className="text-slate-700">{new Date(scope.createdAt || new Date()).toLocaleString()}</span>
[BUCKET A] ./app/(protected)/jobs/schedules/components/DJTModal.tsx:464:                                                    const dateStr = d.toLocaleDateString('en-US', { timeZone: 'UTC' });
[BUCKET A] ./app/(protected)/jobs/schedules/components/DJTModal.tsx:465:                                                    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
[BUCKET B] ./app/(protected)/jobs/schedules/components/DJTModal.tsx:485:                                                                    <span className="text-[10px] text-slate-500 shrink-0">{new Date(email.createdAt).toLocaleDateString()}</span>
[BUCKET C] ./app/(protected)/catalogue/page.tsx:301:                return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
[BUCKET C] ./app/(protected)/catalogue/page.tsx:306:            return val.toLocaleString();
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:766:                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.regPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:773:                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.otPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:780:                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.dtPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:787:                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.grossPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:864:                                            ${totals.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:894:                                                ${group.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:957:                                                        ${employeeSummary.reduce((a, b) => a + b.regPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:960:                                                        ${employeeSummary.reduce((a, b) => a + b.otPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:963:                                                        ${employeeSummary.reduce((a, b) => a + b.dtPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:966:                                                        ${employeeSummary.reduce((a, b) => a + b.gross, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:997:                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">${emp.regPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:998:                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">{emp.otPay > 0 ? `$${emp.otPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</TableCell>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:999:                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">{emp.dtPay > 0 ? `$${emp.dtPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</TableCell>
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:1003:                                                                ${emp.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:1080:                                                            ${record.regPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:1085:                                                            {record.otPay > 0 ? `$${record.otPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:1090:                                                            {record.dtPay > 0 ? `$${record.dtPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
[BUCKET C] ./app/(protected)/reports/workers-comp/page.tsx:1095:                                                            ${record.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:727:                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.regHrs, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:734:                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.otHrs, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:741:                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.dtHrs, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:748:                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.hoursVal, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:821:                                            {totals.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
[BUCKET C] ./app/(protected)/reports/fringe-benefits/page.tsx:852:                                                {group.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
[BUCKET B] ./app/(protected)/reports/daily-activities/page.tsx:164:                                                                    {new Date(a.createdAt).toLocaleString()}
[BUCKET C] ./app/(protected)/reports/payroll/PayrollPDF.tsx:165:              <Text style={styles.summaryValue}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
[BUCKET A] ./app/(protected)/reports/payroll/PayrollPDF.tsx:313:          `Page ${pageNumber} of ${totalPages} | Generated on ${new Date().toLocaleDateString()}`
[BUCKET A] ./app/(protected)/reports/payroll/page.tsx:41:        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
[BUCKET A] ./app/(protected)/reports/payroll/page.tsx:44:        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
[BUCKET A] ./app/(protected)/reports/payroll/page.tsx:47:        return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
[BUCKET A] ./app/(protected)/reports/payroll/page.tsx:55:    return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1254:                                                        ${emp.totalRegAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1270:                                                        ${emp.totalOtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1286:                                                        ${emp.totalDtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1302:                                                        ${emp.totalTravelAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1316:                                                        ${(emp.totalDiem * 50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1330:                                                        ${emp.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1352:                                        ${reportData.reduce((acc, curr) => acc + curr.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1539:                                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET C] ./app/(protected)/reports/payroll/page.tsx:1546:                                        ${selectedDetail.employee.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
[BUCKET A] ./app/(protected)/reports/wip/page.tsx:485:                date: new Date(selectedDJT.date || new Date()).toLocaleDateString(),
[BUCKET A] ./app/(protected)/reports/wip/page.tsx:486:                day: new Date(selectedDJT.date || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./app/api/email-bot/route.ts:13:    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
[BUCKET A] ./app/api/email-bot/route.ts:19:    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
[BUCKET B] ./app/api/email-bot/route.ts:239:                <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated report from <strong>DEVCO CRM</strong>. Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true })} PST.</p>
[BUCKET A] ./app/api/estimates/route.ts:48:            date: payload?.date || new Date().toLocaleDateString(),
[BUCKET A] ./app/api/jha/route.ts:108:                    { $set: { ...updateData, jhaTime: updateData.jhaTime || new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) } },
[BUCKET A] ./app/api/prelim-docs/route.ts:88:                    generatedDate: generatedDate || new Date().toLocaleDateString('en-US'),
[BUCKET A] ./app/api/cron/daily-summary/route.ts:22:    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
[BUCKET A] ./app/api/cron/daily-summary/route.ts:28:    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
[BUCKET B] ./app/api/cron/daily-summary/route.ts:247:                <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated report from <strong>DEVCO CRM</strong>. Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true })} PST.</p>
[BUCKET B] ./app/api/cron/daily-summary/route.ts:306:        const lastSentDayPT = config.lastSent ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(config.lastSent)) : null;
[BUCKET B] ./scratch.tsx:444:                                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
[BUCKET B] ./scratch.tsx:485:                        Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'Unknown date'}
[BUCKET C] ./components/ui/chart.tsx:239:                          {item.value.toLocaleString()}
[BUCKET A] ./components/ui/NotificationBell.tsx:46:    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
[BUCKET B] ./components/ui/EstimateChat.tsx:436:                                                    {new Date(msg.createdAt).toLocaleString([], { 
[BUCKET A] ./components/ui/ScheduleDetailsPopup.tsx:76:        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
[BUCKET A] ./components/ui/ScheduleDetailsPopup.tsx:85:        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
[BUCKET C] ./components/ui/calendar.tsx:44:          date.toLocaleString("default", { month: "short" }),
[BUCKET A] ./components/ui/calendar.tsx:200:      data-day={day.date.toLocaleDateString()}
[BUCKET C] ./components/dialogs/GenericCataloguePickerModal.tsx:103:            if (col.prefix === '$') return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
[BUCKET C] ./components/dialogs/GenericCataloguePickerModal.tsx:105:            return num.toLocaleString();
[BUCKET A] ./components/dialogs/ReceiptModal.tsx:76:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./components/dialogs/ReceiptModal.tsx:96:        paymentDate: format(new Date(), 'yyyy-MM-dd')
[BUCKET A] ./components/dialogs/ReceiptModal.tsx:390:                                                paymentDate: format(new Date(), 'yyyy-MM-dd')
[BUCKET A] ./components/dialogs/BillingTicketModal.tsx:66:        date: format(new Date(), 'yyyy-MM-dd'),
[BUCKET A] ./lib/djtHelper.ts:17:        day: new Date(targetDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
[BUCKET A] ./lib/format/date.ts:7: * - NEVER call new Date(x).toLocaleString() or Intl.DateTimeFormat() on these values.
[BUCKET A] ./lib/templateResolver.ts:19:    return date.toLocaleDateString('en-US', {
