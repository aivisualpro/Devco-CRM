import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * POST /api/distance
 * 
 * Accepts an array of { origin, destination } coordinate pairs and returns
 * driving distances (in miles) from Google Maps Distance Matrix API.
 * Each pair is queried individually (1 origin → 1 destination) to stay within API limits.
 * 
 * Body: { pairs: [{ origin: "lat,lng", destination: "lat,lng" }] }
 * Response: { success: true, results: [{ origin, destination, distanceMiles, durationMinutes }] }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pairs } = body;

        if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
            return NextResponse.json({ success: false, error: 'No coordinate pairs provided' }, { status: 400 });
        }

        if (!GOOGLE_MAPS_API_KEY) {
            return NextResponse.json({ success: false, error: 'Google Maps API key not configured' }, { status: 500 });
        }

        // Process each pair individually to avoid MAX_ELEMENTS_EXCEEDED
        // Limit to 10 pairs max per request to control API costs
        const pairsToProcess = pairs.slice(0, 10);

        console.log('[Distance API] Processing pairs:', pairsToProcess.map((p: any) => `${p.origin} → ${p.destination}`));

        const results = await Promise.all(
            pairsToProcess.map(async (pair: { origin: string; destination: string }) => {
                try {
                    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pair.origin)}&destinations=${encodeURIComponent(pair.destination)}&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;

                    const response = await fetch(url);
                    const data = await response.json();

                    console.log(`[Distance API] ${pair.origin} → ${pair.destination}:`, JSON.stringify(data.rows?.[0]?.elements?.[0] || data));

                    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
                        const element = data.rows[0].elements[0];
                        // distance.value is always in meters regardless of units param
                        const distanceMiles = element.distance.value / 1609.344;
                        const durationMinutes = element.duration.value / 60;
                        return {
                            origin: pair.origin,
                            destination: pair.destination,
                            distanceMiles: Math.round(distanceMiles * 10) / 10,
                            durationMinutes: Math.round(durationMinutes * 10) / 10
                        };
                    } else {
                        console.error('Google Maps element error:', data.status, data.rows?.[0]?.elements?.[0]?.status);
                        return {
                            origin: pair.origin,
                            destination: pair.destination,
                            distanceMiles: -1,
                            durationMinutes: -1
                        };
                    }
                } catch (err) {
                    console.error('Google Maps fetch error for pair:', pair, err);
                    return {
                        origin: pair.origin,
                        destination: pair.destination,
                        distanceMiles: -1,
                        durationMinutes: -1
                    };
                }
            })
        );

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Distance API error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
