import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the app has Supabase credentials. Without them, only Practice mode is available. */
export const backendConfigured = Boolean(url && anon);

/** Browser client (anon key + user session). It can only do what RLS allows. */
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
