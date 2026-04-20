export const getDJTPdfVariablesBase = (targetDJT: any, schedule: any, estimate: any, clientName: string, employees: any[]) => {
    const variables: Record<string, any> = {
        dailyJobDescription: targetDJT.dailyJobDescription || '',
        customerPrintName: targetDJT.customerPrintName || '',
        customerId: clientName || schedule?.customerName || '',
        contactName: estimate?.contactName || estimate?.contact || '',
        contactPhone: estimate?.contactPhone || estimate?.phone || '',
        jobAddress: estimate?.jobAddress || estimate?.address || schedule?.jobLocation || '',
        customerName: schedule?.customerName || clientName || '',
        jobLocation: schedule?.jobLocation || estimate?.jobAddress || '',
        estimate: schedule?.estimate || estimate?.estimate || '',
        estimateNum: schedule?.estimate || estimate?.estimate || '',
        projectName: estimate?.projectTitle || estimate?.projectName || '',
        foremanName: schedule?.foremanName || '',
        date: targetDJT.date ? new Date(targetDJT.date).toLocaleDateString() : '',
        day: new Date(targetDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
    };

    if (targetDJT.customerSignature) variables['customerSignature'] = targetDJT.customerSignature;

    for (let i = 1; i <= 15; i++) {
        variables[`sig_name_${i}`] = '';
        variables[`sig_img_${i}`] = '';
        variables[`Print Name_${i}`] = '';
        variables[`Times_${i}`] = '';
    }

    if (targetDJT.signatures && targetDJT.signatures.length > 0) {
        variables.hasSignatures = true;
        targetDJT.signatures.forEach((sig: any, index: number) => {
            const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
            const idx = index + 1;
            variables[`sig_name_${idx}`] = empName;
            variables[`sig_img_${idx}`] = sig.signature;
            variables[`Print Name_${idx}`] = empName;
            
            const timesheet = schedule?.timesheet?.find((t: any) => t.employee === sig.employee);
            if (timesheet) {
                const inTime = new Date(timesheet.clockIn).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
                const outTime = new Date(timesheet.clockOut).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
                variables[`Times_${idx}`] = `${inTime} - ${outTime}`;
            }
        });
    } else {
        variables.hasSignatures = false;
    }

    return variables;
};
