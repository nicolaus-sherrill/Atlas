import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.");
}

// The publishable key is safe in the browser: row-level security in the database decides
// what each visitor can read and write.
export const supabase = createClient(url, key);
