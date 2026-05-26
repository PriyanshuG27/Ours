import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/types/database.types";

if (typeof window !== "undefined") {
  throw new Error(
    "Supabase admin client cannot be imported on the client side.",
  );
}

export const adminClient = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
