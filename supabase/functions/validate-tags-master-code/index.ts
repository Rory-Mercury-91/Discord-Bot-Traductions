// Edge Function Supabase : validation du code maître pour la gestion des tags.
// Secret TAGS_MASTER_CODE à définir dans Supabase Dashboard > Project Settings > Edge Functions > Secrets.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS preflight
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
    const ref = (Deno.env.get('TAGS_MASTER_CODE') || '').trim();
    if (!ref) {
      return new Response(
        JSON.stringify({ valid: false, error: 'TAGS_MASTER_CODE not configured' }),
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
