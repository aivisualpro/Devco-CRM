const SIGNALWIRE_SPACE_URL = 'devco.signalwire.com';
const SIGNALWIRE_PROJECT_ID = 'eadef30a-69af-404c-9484-2016a5821167';
const SIGNALWIRE_API_TOKEN = 'PTc87d999a6c4ce04cb6baf7ad44b18bcd89e3c11461c46b54';
const SIGNALWIRE_FROM_NUMBER = '+19517400074';

/**
 * Normalise any phone string into E.164 format (+1XXXXXXXXXX).
 * Handles:  (951) 740-0074 | 951-740-0074 | 9517400074 | 19517400074 | +19517400074
 */
function toE164(raw: string): string | null {
    // Strip everything except digits and leading +
    let digits = raw.replace(/[^0-9]/g, '');

    // Remove leading "1" country code if 11 digits
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }

    if (digits.length !== 10) {
        console.warn(`[SignalWire] Invalid phone number (not 10 digits after cleanup): "${raw}" → "${digits}"`);
        return null;
    }

    return `+1${digits}`;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
    const cleanTo = toE164(to);
    if (!cleanTo) return false;

    const url = `https://${SIGNALWIRE_SPACE_URL}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}/Messages.json`;
    const encodedAuth = Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`).toString('base64');

    if (process.env.NODE_ENV !== 'production') console.log(`[SignalWire] Sending SMS to ${cleanTo} (original: "${to}")`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${encodedAuth}`
            },
            body: new URLSearchParams({
                From: SIGNALWIRE_FROM_NUMBER,
                To: cleanTo,
                Body: body
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`[SignalWire] ❌ HTTP ${res.status} sending SMS to ${cleanTo}:`, errText);
            return false;
        }

        const json = await res.json();
        if (process.env.NODE_ENV !== 'production') console.log(`[SignalWire] ✅ SMS queued. SID: ${json.sid}, Status: ${json.status}`);
        return true;
    } catch (err) {
        console.error(`[SignalWire] ❌ Network error sending SMS to ${cleanTo}:`, err);
        return false;
    }
}
