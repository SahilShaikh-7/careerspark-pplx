import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tqzsdsqdmcdkggpaibst.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxenNkc3FkbWNka2dncGFpYnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzEyMjYsImV4cCI6MjA3ODMwNzIyNn0.yfEDHMZmUhI4EariddeJlgcNiZI_6qjWl9iHXUPUDk0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and/or Anon Key is missing.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
