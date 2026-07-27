import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag for components to know if we're in demo mode
export const isSupabaseConfigured =
  !!supabaseUrl &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-key';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
);
