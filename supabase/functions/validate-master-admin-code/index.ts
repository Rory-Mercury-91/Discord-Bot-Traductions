// Edge Function Supabase : validation du code Master Admin (accès config complète).
// Secret MASTER_ADMIN_CODE à définir dans Supabase Dashboard > Project Settings > Edge Functions > Secrets.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ valid: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const ref = (Deno.env.get('MASTER_ADMIN_CODE') || '').trim();
    if (!ref) {
      return new Response(
        JSON.stringify({ valid: false, error: 'MASTER_ADMIN_CODE not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const valid = code.length > 0 && code === ref;

    return new Response(
      JSON.stringify({ valid }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid request' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
