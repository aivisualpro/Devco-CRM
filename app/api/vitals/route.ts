import dbConnect from '@/lib/db';
import { WebVital } from '@/lib/models';

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  
  // Fire and forget — do not await
  if (data) {
    // Extract route from referer as required by the WebVital schema
    const referer = req.headers.get('referer');
    try {
      data.route = referer ? new URL(referer).pathname : 'unknown';
    } catch {
      data.route = 'unknown';
    }
    
    void dbConnect().then(() => WebVital.create(data)).catch(err => console.error('[vitals] write failed', err));
  }
  
  return new Response(null, { status: 204 });
}
