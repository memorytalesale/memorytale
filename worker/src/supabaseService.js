import { createClient } from '@supabase/supabase-js';

// Obtiene URL y KEY desde el entorno de Wrangler
function getUrl(env) {
  return env.SUPABASE_URL || env.SUPABASE_URL_SECRET;
}

// Prioriza service key, con fallback a anon si fuera necesario
function getKey(env) {
  return env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
}

export function getSupabase(env) {
  const url = getUrl(env);
  const key = getKey(env);
  if (!url || !key) {
    throw new Error('Missing Supabase URL or KEY (expect SUPABASE_URL and SUPABASE_SERVICE_KEY)');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

// ── Operaciones CRUD que usaremos ───────────────────────────────
export async function upsertConversation(env, payload) {
  const sb = getSupabase(env);
  const { error } = await sb.from('conversations').upsert(payload, { onConflict: 'session_id' });
  if (error) throw error;
}

export async function appendMessage(env, row) {
  const sb = getSupabase(env);
  const { error } = await sb.from('messages').insert(row);
  if (error) throw error;
}

export async function logEvent(env, row) {
  const sb = getSupabase(env);
  const { error } = await sb.from('analytics_events').insert(row);
  if (error) throw error;
}

export async function getConversationBySession(env, sessionId) {
  const sb = getSupabase(env);
  const { data, error } = await sb
    .from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
