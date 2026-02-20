export async function sendSMS(to: string, body: string) {
    const spaceUrl = 'devco.signalwire.com';
    const projectId = 'eadef30a-69af-404c-9484-2016a5821167';
    const token = 'PTc87d999a6c4ce04cb6baf7ad44b18bcd89e3c11461c46b54';
    const fromNumber = '+19517400074';

    const url = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Messages.json`;
    const encodedAuth = Buffer.from(`${projectId}:${token}`).toString('base64');

    // Phone numbers must typically be E.164 formatted for SignalWire.
    // If it's a 10 digit number "9517400074", it might need "+1" prefix.
    // Clean up format here broadly:
    let cleanTo = to.replace(/[^0-9+]/g, '');
    if (cleanTo.length === 10) {
        cleanTo = `+1${cleanTo}`;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${encodedAuth}`
        },
        body: new URLSearchParams({
            From: fromNumber,
            To: cleanTo,
            Body: body
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[SignalWire] Error sending SMS to ${cleanTo}:`, err);
        return false;
    }

    return true;
}
