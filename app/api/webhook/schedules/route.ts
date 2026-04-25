export async function POST() {
  // TODO: Full removal in 30 days (June 2026)
  return new Response(JSON.stringify({ ok: true, deprecated: true }), { 
    status: 200, headers: { 'Content-Type': 'application/json' } 
  });
}
