import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/generated/database.types"
import {
  getPublicSupabaseEnvironment,
  getSupabaseSecretKey,
} from "@/lib/supabase/env"

export function createAdminClient() {
  const { url } = getPublicSupabaseEnvironment()

  return createClient<Database>(url, getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
