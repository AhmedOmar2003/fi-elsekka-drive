import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = 'https://placeholder.supabase.co';
const fallbackSupabaseAnonKey = 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && process.env.NODE_ENV !== 'production') {
    console.warn('Supabase env vars are missing. Using a placeholder client until real env vars are provided.');
}

export const supabase = createClient(supabaseUrl || fallbackSupabaseUrl, supabaseAnonKey || fallbackSupabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
});
